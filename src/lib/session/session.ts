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
      return skill in GENERATORS ? [{ factKey, skill: skill as ImplementedSkill }] : []
    })
    .slice(0, nReview)

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

  // Break up runs of three. The per-slot skill is fixed once the plan is made,
  // so the generation loop's retry cannot fix a run by redrawing — it has to be
  // smoothed here. A run survives only when there is nothing to swap with.
  for (let i = 2; i < plan.length; i++) {
    if (plan[i].skill !== plan[i - 1].skill || plan[i].skill !== plan[i - 2].skill) continue
    const j = plan.findIndex((s, k) => k > i && s.skill !== plan[i].skill)
    if (j !== -1) [plan[i], plan[j]] = [plan[j], plan[i]]
  }

  return plan
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
  const blocks = focus === undefined
    ? null
    : { of: focus, slots: buildPlan(progress, focus, length, now, rng) }
  const available = unlockedSkills(progress)
  const asked = new Set<string>()

  const draw = (problems: Problem[]): Problem => {
    const i = problems.length
    while (blocks && i >= blocks.slots.length) {
      blocks.slots.push(...buildPlan(progress, blocks.of, length, now, rng))
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
    const drawOne = () => {
      if (!slot) return generate(nextSkill(progress, rng), rng)
      if (!slot.factKey) return generate(slot.skill, rng)
      for (let t = 0; t < TARGET_TRIES; t++) {
        const candidate = generate(slot.skill, rng)
        if (candidate.factKey === slot.factKey) return candidate
      }
      return generate(slot.skill, rng)
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

/** Returns a new session; never mutates. */
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
   */
  if (!isComplete(next) && next.index >= next.problems.length) {
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
