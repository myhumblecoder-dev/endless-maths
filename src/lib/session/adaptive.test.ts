import { test } from 'vitest'
import assert from 'node:assert/strict'
import { startSession, answer, currentProblem, isComplete, summary, goalOfSession } from './session'
import { SESSION_CAP } from './goal'
import { emptyProgress } from '@/lib/mastery/mastery'
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

const start = (seed = 42, progress = emptyProgress()) =>
  startSession(progress, seeded(seed), { skill: 'a-add-within-20', now: 0 })

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
