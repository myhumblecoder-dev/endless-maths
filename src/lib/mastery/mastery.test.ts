import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  skillProgress,
  emptyProgress,
  record,
  factMedianMs,
  isFactMastered,
  isSkillMastered,
  skillCorrectRate,
  FLUENCY_MS,
} from './mastery'
import type { Attempt, SkillId } from '@/lib/curriculum/types'
import type { Progress } from './mastery'

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  problemId: 'm-times-6-7-8-9#7,8',
  skill: 'm-times-6-7-8-9',
  factKey: 'mul:7x8',
  given: '56',
  verdict: 'correct',
  elapsedMs: 1200,
  at: 1_000_000,
  ...over,
})

test('a new learner has no history', () => {
  const p = emptyProgress()
  assert.deepEqual(p.facts, {})
  assert.deepEqual(p.skills, {})
})

test('recording an attempt creates fact state and advances the box', () => {
  const p = record(emptyProgress(), attempt())
  const f = p.facts['mul:7x8']
  assert.equal(f.box, 1)
  assert.equal(f.seen, 1)
  assert.equal(f.correct, 1)
  assert.equal(factMedianMs(f), 1200)
})

test('record does not mutate the progress passed in', () => {
  const before = emptyProgress()
  record(before, attempt())
  assert.deepEqual(before.facts, {}, 'record must be pure')
})

test('three fast correct answers master a fact', () => {
  let p = emptyProgress()
  for (let i = 0; i < 3; i++) p = record(p, attempt({ elapsedMs: 1500 }))
  assert.equal(isFactMastered(p.facts['mul:7x8']), true)
})

// The point of the whole fluency model: recalling and working it out are
// different things, and only the first is mastery.
test('three SLOW correct answers do NOT master a fact', () => {
  let p = emptyProgress()
  for (let i = 0; i < 3; i++) p = record(p, attempt({ elapsedMs: FLUENCY_MS + 2000 }))
  const f = p.facts['mul:7x8']
  assert.equal(f.correct, 3, 'all three were correct')
  assert.equal(isFactMastered(f), false, 'but nine seconds of counting up is not recall')
})

test('a wrong answer sends the fact back to box zero', () => {
  let p = emptyProgress()
  for (let i = 0; i < 3; i++) p = record(p, attempt({ elapsedMs: 1000 }))
  p = record(p, attempt({ verdict: 'incorrect', given: '54' }))
  const f = p.facts['mul:7x8']
  assert.equal(f.box, 0)
  assert.equal(isFactMastered(f), false)
})

test('median ignores a single slow outlier', () => {
  let p = emptyProgress()
  for (const ms of [1000, 1100, 9000, 1200, 1050]) p = record(p, attempt({ elapsedMs: ms }))
  assert.ok(factMedianMs(p.facts['mul:7x8']) < FLUENCY_MS, 'one distraction should not undo a fact')
})

// ---- procedures ----------------------------------------------------------

const procAttempt = (over: Partial<Attempt> = {}): Attempt => ({
  problemId: 'p-solve-two-step#3,4,5',
  skill: 'p-solve-two-step',
  given: '5',
  verdict: 'correct',
  elapsedMs: 40_000,
  at: 1_000_000,
  ...over,
})

test('procedures master on accuracy and ignore how long they took', () => {
  let p = emptyProgress()
  for (let i = 0; i < 10; i++) p = record(p, procAttempt())
  assert.equal(
    isSkillMastered(p, 'p-solve-two-step'),
    true,
    'forty seconds on a two-step equation is correct behaviour, not failure',
  )
})

test('a procedure is not mastered before enough attempts', () => {
  let p = emptyProgress()
  for (let i = 0; i < 3; i++) p = record(p, procAttempt())
  assert.equal(isSkillMastered(p, 'p-solve-two-step'), false)
})

test('a procedure with poor accuracy is not mastered', () => {
  let p = emptyProgress()
  for (let i = 0; i < 10; i++) p = record(p, procAttempt({ verdict: i % 2 ? 'correct' : 'incorrect' }))
  assert.ok(skillCorrectRate(p, 'p-solve-two-step') < 0.85)
  assert.equal(isSkillMastered(p, 'p-solve-two-step'), false)
})

test('an unseen skill is not mastered', () => {
  assert.equal(isSkillMastered(emptyProgress(), 'p-solve-two-step'), false)
})

// ---- progress worth looking at --------------------------------------------
// A binary "done" tick is thin for an 11- to 13-year-old. Accuracy and whether
// it is moving are what they can act on.

const attempt10 = (skill: SkillId, verdicts: boolean[]): Progress => {
  let p = emptyProgress()
  verdicts.forEach((ok, i) => {
    p = record(p, {
      problemId: `${skill}#${i}`, skill,
      given: 'x', verdict: ok ? 'correct' : 'incorrect',
      elapsedMs: 2000, at: i,
    })
  })
  return p
}

test('a skill never practised has nothing to report', () => {
  assert.equal(skillProgress(emptyProgress(), 'm-times-6-7-8-9'), undefined)
})

test('accuracy is reported over the recent window', () => {
  const p = attempt10('m-times-6-7-8-9', [true, true, true, true, false])
  const s = skillProgress(p, 'm-times-6-7-8-9')!
  assert.equal(s.attempts, 5)
  assert.equal(Math.round(s.accuracy * 100), 80)
})

/**
 * A lifetime average hides exactly what a learner wants to know. Someone who
 * was at 40% and is now at 90% should see that, not a flat 65%.
 */
test('improving shows as improving', () => {
  const p = attempt10('m-times-6-7-8-9',
    [false, false, false, false, false, true, true, true, true, true])
  assert.equal(skillProgress(p, 'm-times-6-7-8-9')!.trend, 'up')
})

test('slipping shows as slipping', () => {
  const p = attempt10('m-times-6-7-8-9',
    [true, true, true, true, true, false, false, false, false, false])
  assert.equal(skillProgress(p, 'm-times-6-7-8-9')!.trend, 'down')
})

test('holding steady is not dressed up as movement', () => {
  const p = attempt10('m-times-6-7-8-9',
    [true, true, true, true, false, true, true, true, true, false])
  assert.equal(skillProgress(p, 'm-times-6-7-8-9')!.trend, 'steady')
})

test('a trend is not claimed from too little data', () => {
  const p = attempt10('m-times-6-7-8-9', [true, false, true])
  assert.equal(skillProgress(p, 'm-times-6-7-8-9')!.trend, 'unknown',
    'three answers is not a trend')
})

test('progress never leaves the device', () => {
  // The whole record is a plain object in localStorage; nothing here fetches.
  const p = attempt10('m-times-6-7-8-9', [true, true])
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p, 'progress must stay serialisable')
})

/**
 * Placement is a claim; practice is evidence. Once there is enough evidence,
 * it should win — otherwise a skill someone placed out of stays ticked "done"
 * while they get 30% of it wrong, which is both wrong and visibly odd.
 */
test('real practice overrides what placement claimed', () => {
  const placedOut: Progress = {
    ...emptyProgress(),
    placed: ['n-place-value-100'],
    placementDone: true,
  }
  assert.equal(isSkillMastered(placedOut, 'n-place-value-100'), true, 'placed out of it')

  let p = placedOut
  for (let i = 0; i < 10; i++) {
    p = record(p, {
      problemId: `n-place-value-100#${i}`, skill: 'n-place-value-100',
      given: 'x', verdict: i < 3 ? 'correct' : 'incorrect', elapsedMs: 3000, at: i,
    })
  }
  assert.equal(isSkillMastered(p, 'n-place-value-100'), false,
    '30% across ten attempts is not mastery, whatever the quiz said')
})

test('placement still stands until there is evidence against it', () => {
  let p: Progress = { ...emptyProgress(), placed: ['n-place-value-100'], placementDone: true }
  // A couple of wrong answers is not enough to overturn a placement.
  for (let i = 0; i < 3; i++) {
    p = record(p, {
      problemId: `n-place-value-100#${i}`, skill: 'n-place-value-100',
      given: 'x', verdict: 'incorrect', elapsedMs: 3000, at: i,
    })
  }
  assert.equal(isSkillMastered(p, 'n-place-value-100'), true)
})

test('practising a placed skill well keeps it mastered', () => {
  let p: Progress = { ...emptyProgress(), placed: ['n-place-value-100'], placementDone: true }
  for (let i = 0; i < 10; i++) {
    p = record(p, {
      problemId: `n-place-value-100#${i}`, skill: 'n-place-value-100',
      given: 'x', verdict: 'correct', elapsedMs: 1500, at: i,
    })
  }
  assert.equal(isSkillMastered(p, 'n-place-value-100'), true)
})
