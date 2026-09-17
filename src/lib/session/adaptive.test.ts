import { test } from 'vitest'
import assert from 'node:assert/strict'
import { startSession, answer, currentProblem, isComplete, summary, goalOfSession } from './session'
import { SESSION_CAP } from './goal'
import { emptyProgress, record } from '@/lib/mastery/mastery'
import type { SkillId } from '@/lib/curriculum/types'
import { seeded } from '@/lib/problems'
import { formatAnswer } from '@/lib/problems/format'
import type { Session } from './session'

/**
 * A learner with several skills behind them, so a session has something to
 * interleave. With nothing unlocked there is only one topic to draw from, and
 * "don't repeat a skill" has no meaning.
 */
const experienced = () => ({
  ...emptyProgress(),
  placed: ['n-bonds-10', 'n-compare-20', 'n-place-value-100', 'a-add-within-10',
           'a-sub-within-10', 'a-add-within-20'] as SkillId[],
  placementDone: true,
})

/** A day after the recorded attempts, so anything owed is genuinely due. */
const LATER = 24 * 60 * 60 * 1000

const start = (seed = 42, progress = emptyProgress()) =>
  startSession(progress, seeded(seed), { skill: 'a-add-within-20', now: LATER })

const right = (s: Session): Session => {
  const p = currentProblem(s)
  assert.ok(p, 'ran out of problems mid-session')
  return answer(s, formatAnswer(p.answer).replace(/−/g, '-'), 1000, 0)
}

const wrong = (s: Session): Session => {
  assert.ok(currentProblem(s), 'ran out of problems mid-session')
  return answer(s, 'definitely not the answer', 1000, 0)
}

/** Answer until the session ends, getting one in every `every` wrong. */
function play(seed: number, every: number, progress = emptyProgress()): Session {
  let s = start(seed, progress)
  for (let i = 0; !isComplete(s); i++) s = i % every === every - 1 ? wrong(s) : right(s)
  return s
}

test('a clean run is twenty questions and no more', () => {
  let s = start()
  for (let i = 0; i < 20; i++) s = right(s)
  assert.equal(isComplete(s), true)
  assert.equal(summary(s).answered, 20)
})

/** The whole point: wrong answers buy more questions. */
test('getting them wrong makes the session longer', () => {
  const clean = play(42, Infinity)
  const sloppy = play(42, 5)
  assert.ok(summary(sloppy).answered > summary(clean).answered,
    `${summary(sloppy).answered} should exceed ${summary(clean).answered}`)
})

test('the worse it goes, the longer it runs', () => {
  const lengths = [10, 6, 4].map((every) => summary(play(7, every)).answered)
  assert.deepEqual([...lengths].sort((a, b) => a - b), lengths,
    `expected increasing effort, got ${lengths.join(', ')}`)
})

/**
 * Deferral, not mercy. Nobody is kept at the keyboard indefinitely — the topic
 * comes back tomorrow instead, one level easier. See goal.ts.
 */
test('nobody is ever asked more than the cap', () => {
  for (const seed of [1, 2, 3]) {
    const s = play(seed, 2) // half of them wrong: this never reaches 90%
    assert.equal(summary(s).answered, SESSION_CAP)
    assert.equal(goalOfSession(s).reachedCap, true)
    assert.equal(goalOfSession(s).done, false, 'reaching the cap is not a pass')
  }
})

/**
 * Problems are drawn as the session needs them. Running out mid-session would
 * strand the learner on a blank screen with no way to finish.
 */
test('a lengthened session never runs out of questions', () => {
  let s = start()
  for (let i = 0; i < 40 && !isComplete(s); i++) {
    assert.ok(currentProblem(s), `no problem at ${i}`)
    s = i % 3 === 0 ? wrong(s) : right(s)
  }
})

test('the extra questions keep the variety rules', () => {
  const s = play(9, 3, experienced())
  const skills = s.problems.map((p) => p.skill)
  for (let i = 2; i < skills.length; i++) {
    assert.ok(!(skills[i] === skills[i - 1] && skills[i] === skills[i - 2]),
      `three ${skills[i]} in a row at ${i + 1} of a lengthened session`)
  }
})

test('the extra questions still come from the topic being practised', () => {
  const s = play(9, 3)
  const focus = s.problems.filter((p) => p.skill === 'a-add-within-20').length
  assert.ok(focus >= s.problems.length * 0.4,
    `only ${focus} of ${s.problems.length} were the topic in hand`)
})

test('the same seed replays the same lengthened session', () => {
  const a = play(11, 4).problems.map((p) => p.prompt)
  const b = play(11, 4).problems.map((p) => p.prompt)
  assert.deepEqual(a, b)
})

// ---- what the learner sees -------------------------------------------------

/**
 * The finish line is honest about moving. Hiding it would be worse: a counter
 * that silently stops counting down reads as a broken app.
 */
test('the projected total grows when they slip and shrinks as they recover', () => {
  let s = start()
  for (let i = 0; i < 10; i++) s = right(s)
  const onTrack = summary(s).total
  assert.equal(onTrack, 20, 'on track means the original twenty')

  s = wrong(s)
  s = wrong(s)
  s = wrong(s)
  const slipped = summary(s).total
  assert.ok(slipped > onTrack, `${slipped} should exceed ${onTrack}`)

  for (let i = 0; i < 5; i++) s = right(s)
  assert.ok(summary(s).total < slipped + 5, 'recovering must pull it back in')
})

test('the projected total is never a promise past the cap', () => {
  const s = play(3, 2)
  assert.ok(summary(s).total <= SESSION_CAP)
})

// ---- findings from code review ---------------------------------------------

/**
 * The plan grows a block at a time, and the run-smoothing pass only ever saw
 * the fresh block — so slots 0 and 1 of each new block were never compared
 * against the tail of the one before. The generation loop cannot repair it
 * either: once a slot names a skill, every redraw returns that same skill, so
 * the retry spins through all its attempts and accepts the run anyway.
 *
 * "Six number bonds in a row reads as a broken app" is why the constraint
 * exists; a seam every twenty questions is where it was breaking.
 */
test('the variety rules hold across a block seam, not just within a block', () => {
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
    const s = play(seed, 1, experienced()) // everything wrong: runs to the cap
    const skills = s.problems.map((p) => p.skill)
    for (let i = 2; i < skills.length; i++) {
      assert.ok(!(skills[i] === skills[i - 1] && skills[i] === skills[i - 2]),
        `seed ${seed}: three ${skills[i]} in a row at index ${i}`)
    }
  }
})

/**
 * Every block re-planned the SAME due facts, because each call saw the
 * original progress. Those slots then collided with what had already been
 * asked, so each one burned its way through every retry before settling for a
 * repeat — and a fact the learner had just answered was scheduled again as
 * though it were still owed.
 */
test('a due fact is targeted once, not once per block', () => {
  // A fact answered wrong is due, and stays due until it is met again. A bond
  // to ten, because targeting a specific fact means drawing until it comes up:
  // there are nine of those, against 247 sums within twenty, so this actually
  // lands inside the attempts a session gives it.
  const progress = record({ ...experienced() }, {
    problemId: 'x', skill: 'n-bonds-10', factKey: 'bond10:4',
    given: '7', verdict: 'incorrect', elapsedMs: 1000, at: 0,
  })

  const s = play(4, 1, progress)
  const targeted = s.problems.filter((p) => p.factKey === 'bond10:4').length
  assert.ok(targeted >= 1, 'a missed fact must come back at all — otherwise this proves nothing')
  assert.ok(targeted <= 2,
    `the same fact was scheduled ${targeted} times in one session`)
})

/**
 * An unsimplified answer is right but unfinished, so the learner stays on the
 * question and `Practice` throws the resulting session away. `answer` had
 * already drawn the replacement though — the seeded rng had moved on and a
 * prompt nobody ever saw was marked as asked, suppressing it for the rest of
 * the session.
 */
test('an answer that does not finish the problem does not draw the next one', () => {
  // One problem, so answering it sits exactly on the boundary where the next
  // one would be drawn. 4/12 + 2/12 is 6/12, which is right but not finished.
  const s = fractionSession(4, 1)
  const discarded = answer(s, unsimplifiedFor(s), 1000, 0)

  assert.equal(discarded.attempts[0].verdict, 'equivalent-unsimplified',
    'the premise of this test is that the answer does not complete the problem')
  assert.equal(discarded.problems.length, s.problems.length,
    'staying on the same question must not consume the next one')
})

test('a discarded attempt leaves the seeded run exactly where it was', () => {
  const slipped = fractionSession(4, 1)
  answer(slipped, unsimplifiedFor(slipped), 1000, 0) // thrown away, as Practice does
  const clean = fractionSession(4, 1)

  // `draw` is the shared state: the seeded rng, and what has been asked. If the
  // discarded attempt moved either, the next question differs.
  assert.equal(
    slipped.draw(slipped.problems).prompt,
    clean.draw(clean.problems).prompt,
    'a seeded run must not diverge because of an answer that was never kept',
  )
})

const fractionSession = (seed: number, length?: number) =>
  startSession(
    { ...emptyProgress(), placementDone: true, placed: ['f-add-like'] as SkillId[] },
    seeded(seed),
    { skill: 'f-add-like', length, now: 0 },
  )

/** `a/d + b/d` before reducing — right, but not finished. */
function unsimplifiedFor(s: Session): string {
  const problem = currentProblem(s)
  assert.ok(problem)
  const [, a, den, b] = /^(\d+)\/(\d+) \+ (\d+)\/\2$/.exec(problem.prompt) ?? []
  assert.ok(den, `expected a like-denominator sum, got "${problem.prompt}"`)
  return `${Number(a) + Number(b)}/${den}`
}

/** Wider sweep: the seam fix must not be a fix for eight lucky seeds. */
test('no session at any length runs a skill three times in a row', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const every of [1, 2, 3, 5]) {
      const s = play(seed, every, experienced())
      const skills = s.problems.map((p) => p.skill)
      for (let i = 2; i < skills.length; i++) {
        assert.ok(!(skills[i] === skills[i - 1] && skills[i] === skills[i - 2]),
          `seed ${seed}, one wrong in ${every}: three ${skills[i]} in a row at ${i}`)
      }
    }
  }
})
