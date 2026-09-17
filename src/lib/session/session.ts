/**
 * One bounded run of problems.
 *
 * The supply is endless; a session is not. A child needs a finish line — see
 * docs/design.md § Endless supply, bounded sessions.
 */

import type { Attempt, Problem, Rng, Verdict } from '@/lib/curriculum/types'
import { GENERATORS, generate, type ImplementedSkill } from '@/lib/problems'
import { check } from '@/lib/problems/check'
import { record, type Progress } from '@/lib/mastery/mastery'
import { difficultyFor } from '@/lib/mastery/levels'
import { nextSkill, unlockedSkills, weakestDueFirst } from './scheduler'
import { DEFAULT_SESSION_LENGTH, sessionLengthOf } from './length'
import { goalOf, type Goal } from './goal'
import { isSkillMastered } from '@/lib/mastery/mastery'

/**
 * The default run. Long enough to matter, short enough to finish — but now a
 * default rather than a rule: see session/length.ts.
 */
export const SESSION_LENGTH = DEFAULT_SESSION_LENGTH

export type Session = {
  problems: Problem[]
  index: number
  attempts: Attempt[]
  progress: Progress
  /** The shortest this session may be — the learner's chosen length. */
  minimum: number
  /**
   * Draws the next problem, honouring the variety rules against what has been
   * asked so far.
   *
   * A session no longer has a fixed length: it runs until 90% of the last
   * twenty are right, so how many problems it needs is not known when it
   * starts. Only the minimum is drawn up front — the rest arrive one at a time
   * as wrong answers buy them.
   *
   * Stateful, because the seeded rng it closes over is. Replaying a seed
   * reproduces the session exactly as long as the answers are the same, which
   * is what reproducibility means for a session whose length depends on them.
   */
  draw: (soFar: Problem[]) => Problem
}

/** Attempts to find a fresh question before accepting a repeat. */
const VARIETY_TRIES = 25

/** Consecutive problems allowed from one skill before forcing a change. */
const MAX_RUN = 2

/**
 * How a session is made up. Blocked practice — twenty of one skill — is the
 * weaker option: Sparx (11-16, Cambridge trial) mixes previously covered topics
 * into every task, and Donoghue & Hattie's review of 242 studies puts
 * distributed practice and interleaving among the best-supported strategies.
 * Roughly: half the chosen skill, a third review, the rest stretch.
 * See docs/research.md.
 */
const MIX = { chosen: 0.5, review: 0.3, stretch: 0.2 } as const

/**
 * The whole session is drawn up front so the child never waits, and so the
 * same seed replays the same set — a teacher can hand one session to a class.
 *
 * Drawing uniformly at random looked fine in tests and terrible in practice:
 * six number bonds in a row, and the same question twice in twenty. Both read
 * as a broken app, so variety is enforced on two axes — no repeated question,
 * and no more than `MAX_RUN` of one skill back to back.
 *
 * Both constraints yield rather than fail. `n-bonds-10` has only nine possible
 * questions, so a long enough session must be allowed to repeat instead of
 * hanging.
 */
export type SessionOptions = {
  length?: number
  /** The skill the session is built around, as chosen from the topic map. */
  skill?: ImplementedSkill
  /**
   * The clock, for deciding which facts are due. Defaults to now; passed
   * explicitly by tests so a session is fully determined by its inputs.
   */
  now?: number
}

/** One slot of a session: which skill, and optionally which specific fact. */
type Slot = { skill: ImplementedSkill; factKey?: string }

/** Attempts to hit a specific fact before settling for any problem in its skill. */
const TARGET_TRIES = 60

/**
 * The skill each slot of the session draws from.
 *
 * Review comes from skills already mastered, stretch from unlocked skills not
 * yet mastered. Either pool can be empty — a learner on their first session has
 * nothing to review — and an empty pool falls back to the chosen skill rather
 * than shortening the session.
 */
function buildPlan(
  progress: Progress,
  focus: ImplementedSkill,
  length: number,
  now: number,
  rng: Rng,
  /**
   * Facts already scheduled earlier in this session. Mutated as more are
   * taken.
   *
   * Without it every block re-planned the same due facts, because each call
   * sees the same progress: a fact the learner had answered two questions ago
   * was scheduled again as though it were still owed, then collided with what
   * had already been asked and burned every retry before settling for a
   * repeat.
   */
  targeted: Set<string> = new Set(),
): Slot[] {
  const unlocked = unlockedSkills(progress).filter((s) => s !== focus)
  const review = unlocked.filter((s) => isSkillMastered(progress, s))
  const stretch = unlocked.filter((s) => !isSkillMastered(progress, s))

  const take = (pool: ImplementedSkill[], n: number): Slot[] =>
    pool.length === 0
      ? Array.from({ length: n }, () => ({ skill: focus }))
      : Array.from({ length: n }, () => ({ skill: pool[Math.floor(rng() * pool.length)] }))

  const nReview = Math.round(length * MIX.review)
  const nStretch = Math.round(length * MIX.stretch)

  /**
   * Review slots go to facts that are actually due, weakest first, rather than
   * a random draw. This is the point of tracking facts at all: a missed 7 x 8
   * has to come back. Falls through to a random review draw when nothing is
   * due, and skips facts whose skill has no generator.
   */
  const due: Slot[] = weakestDueFirst(progress, now)
    .flatMap((factKey) => {
      const skill = progress.facts[factKey].skill
      // A fact can outlive its generator — skip rather than crash on it.
      if (targeted.has(factKey) || !(skill in GENERATORS)) return []
      return [{ factKey, skill: skill as ImplementedSkill }]
    })
    .slice(0, nReview)
  for (const slot of due) if (slot.factKey) targeted.add(slot.factKey)

  const plan: Slot[] = [
    ...Array.from({ length: length - nReview - nStretch }, () => ({ skill: focus })),
    ...due,
    ...take(review, nReview - due.length),
    ...take(stretch, nStretch),
  ]

  // Shuffle so the review is genuinely interleaved rather than tacked on the
  // end. Fisher-Yates, driven by the session seed so this stays reproducible.
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[plan[i], plan[j]] = [plan[j], plan[i]]
  }

  smoothRuns(plan)
  return plan
}

/**
 * Break up runs of three, in place, from `from` onwards.
 *
 * The per-slot skill is fixed once the plan is made, so the generation loop's
 * retry cannot fix a run by redrawing: every redraw of a slot returns the same
 * skill, so it spins through all its attempts and accepts the run anyway. It
 * has to be smoothed here. A run survives only when there is nothing to swap
 * with.
 *
 * `from` is what makes this work across a block seam. Smoothing each new block
 * on its own never compared its first two slots against the tail of the block
 * before, so a run of three appeared at every seam — one every twenty
 * questions, for exactly the learner whose session had gone long enough to
 * have seams. Only slots at or after `from` move, so questions already asked
 * are never reordered.
 */
function smoothRuns(plan: Slot[], from = 2): void {
  /** Would putting `skill` here make a run of three with its new neighbours? */
  const fits = (at: number, skill: string): boolean => {
    const s = (k: number) => plan[k]?.skill
    return !(s(at - 1) === skill && s(at - 2) === skill)
      && !(s(at - 1) === skill && s(at + 1) === skill)
      && !(s(at + 1) === skill && s(at + 2) === skill)
  }

  for (let i = Math.max(2, from); i < plan.length; i++) {
    if (plan[i].skill !== plan[i - 1].skill || plan[i].skill !== plan[i - 2].skill) continue

    /**
     * Forward first, and unchecked: anything the swap disturbs is a position
     * this loop has not reached yet, so it gets its own chance to be fixed.
     */
    let j = plan.findIndex((s, k) => k > i && s.skill !== plan[i].skill)

    /**
     * Then backwards, which is what saves a run near the end of the plan.
     * With the tail saturated there is nothing later to swap with, and the run
     * used to just survive — one every twenty questions, in the session of the
     * child whose session had gone long enough to have a tail.
     *
     * Bounded by `from`, so a question already asked is never reordered, and
     * checked before the swap, because this loop will not come back to fix
     * whatever it disturbs.
     */
    if (j === -1) {
      j = plan.findIndex((s, k) =>
        k >= Math.max(2, from) && k < i && s.skill !== plan[i].skill && fits(k, plan[i].skill))
    }

    if (j !== -1) [plan[i], plan[j]] = [plan[j], plan[i]]
  }
}

export function startSession(progress: Progress, rng: Rng, options: SessionOptions = {}): Session {
  // An explicit length wins; otherwise the learner's preference; otherwise the
  // default.
  const { length = sessionLengthOf(progress), skill: focus, now = Date.now() } = options

  /**
   * The plan is built a block at a time, each block the length of the minimum.
   *
   * A session that goes badly keeps going, so the plan has to grow with it —
   * but planning the whole cap up front is wrong in both directions. It thins
   * the mix in the first twenty questions, which is the only stretch most
   * sessions ever reach, and it pushes due facts past the point where anyone
   * sees them: a missed 7 × 8 would be scheduled into question 43 of a session
   * that ends at 20. Per-block keeps every block's mix exact.
   */
  const targeted = new Set<string>()
  const blocks = focus === undefined
    ? null
    : { of: focus, slots: buildPlan(progress, focus, length, now, rng, targeted) }
  const available = unlockedSkills(progress)
  const asked = new Set<string>()

  const draw = (problems: Problem[]): Problem => {
    const i = problems.length
    /**
     * One slot of look-ahead, not zero.
     *
     * The LAST slot of a block had nothing after it to swap with when the block
     * was smoothed, so a run of three survived at the end of every block —
     * index 39, then 59. Appending the next block while that slot is still
     * undrawn gives the smoothing pass somewhere to put it.
     *
     * Smoothing then runs from `i`: everything before it has already been asked
     * and must not be reordered, everything from it on is still free to move.
     */
    while (blocks && i + 1 >= blocks.slots.length) {
      blocks.slots.push(...buildPlan(progress, blocks.of, length, now, rng, targeted))
      smoothRuns(blocks.slots, i)
    }
    // How many of the immediately preceding problems share a skill.
    const runLength = (skill: string) => {
      let n = 0
      while (n < problems.length && problems[problems.length - 1 - n].skill === skill) n++
      return n
    }

    const slot = blocks?.slots[i]

    /**
     * Resurfacing a specific fact means drawing until that fact comes up —
     * generators produce a random problem from their skill, they cannot be
     * asked for one. A bounded number of attempts, then settle for any problem
     * from the right skill, which is still useful review.
     */
    /**
     * Every topic is asked at ITS OWN level, review and stretch included.
     *
     * This is the wire the whole difficulty mechanism hangs from, and it was
     * missing: the stored level reached the picker and the announcement but
     * never a generator, so a child told "next time these will start a bit
     * gentler" was handed the identical questions. See adapt.ts — a promise the
     * app does not keep is the one thing that makes it untrustworthy.
     */
    const ask = (of: ImplementedSkill) => generate(of, rng, difficultyFor(progress, of))

    const drawOne = () => {
      if (!slot) return ask(nextSkill(progress, rng))
      if (!slot.factKey) return ask(slot.skill)
      for (let t = 0; t < TARGET_TRIES; t++) {
        const candidate = ask(slot.skill)
        if (candidate.factKey === slot.factKey) return candidate
      }
      return ask(slot.skill)
    }

    let candidate = drawOne()

    for (let attempt = 0; attempt < VARIETY_TRIES; attempt++) {
      const stale = asked.has(candidate.prompt)
      const overrun = available.length > 1 && runLength(candidate.skill) >= MAX_RUN
      if (!stale && !overrun) break
      candidate = drawOne()
    }

    asked.add(candidate.prompt)
    return candidate
  }

  const problems: Problem[] = []
  for (let i = 0; i < length; i++) problems.push(draw(problems))

  return { problems, index: 0, attempts: [], progress, minimum: length, draw }
}

export const currentProblem = (s: Session): Problem | undefined => s.problems[s.index]

/** How this session is doing against the 90%-of-the-last-twenty rule. */
export const goalOfSession = (s: Session): Goal =>
  goalOf(s.attempts.map((a) => a.verdict === 'correct'), s.minimum)

/**
 * A session ends when the goal is met, or at the cap. Not at a fixed count —
 * the finish line is 90% of the last twenty, and wrong answers push it away.
 */
export const isComplete = (s: Session): boolean => goalOfSession(s).over

/**
 * Returns a new session; never mutates the one passed in.
 *
 * It does advance the draw state that every session from one `startSession`
 * shares — the seeded rng, what has been asked, and the plan. That is what
 * makes a session extendable at all, and it is why a discarded answer must not
 * reach the draw below.
 */
export function answer(s: Session, given: string, elapsedMs: number, at: number): Session {
  const problem = currentProblem(s)
  if (!problem) return s

  const attempt: Attempt = {
    problemId: problem.id,
    skill: problem.skill,
    factKey: problem.factKey,
    given,
    verdict: check(problem.answer, given),
    elapsedMs,
    at,
  }

  const next: Session = {
    ...s,
    index: s.index + 1,
    attempts: [...s.attempts, attempt],
    progress: record(s.progress, attempt),
  }

  /**
   * Keep one question ahead of the learner.
   *
   * Drawing the whole cap up front instead would force sixty questions out of
   * skills that have nine — `n-bonds-10` would repeat itself before the child
   * ever earned the extra questions. Drawing on demand means a clean session
   * never generates a problem it does not ask.
   *
   * Only when the answer actually finished the problem. An unsimplified answer
   * leaves them on the same question and `Practice` throws this session away —
   * but the draw had already happened, so the seeded rng had moved on and a
   * prompt nobody ever saw was marked as asked, suppressing it for the rest of
   * the session.
   */
  if (completesProblem(attempt.verdict) && !isComplete(next) && next.index >= next.problems.length) {
    next.problems = [...next.problems, next.draw(next.problems)]
  }

  return next
}

/**
 * Does this verdict move the learner on?
 *
 * Everything does except an unsimplified answer — the value is right but the
 * skill is not finished, so they stay on the question and try again. See
 * docs/design.md, "Simplifying is part of the skill".
 */
export const completesProblem = (verdict: Verdict): boolean =>
  verdict !== 'equivalent-unsimplified'

export function summary(s: Session) {
  const goal = goalOfSession(s)
  return {
    answered: s.attempts.length,
    correct: s.attempts.filter((a) => a.verdict === 'correct').length,
    /**
     * Where the finish line is NOW — answered plus however many more the
     * current run of answers implies. It is twenty for a learner on track, and
     * it moves, which is the rule made visible rather than hidden.
     */
    total: s.attempts.length + goal.remaining,
    goal,
  }
}
