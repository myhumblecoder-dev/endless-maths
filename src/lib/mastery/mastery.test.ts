import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  emptyProgress,
  record,
  factMedianMs,
  isFactMastered,
  isSkillMastered,
  skillCorrectRate,
  FLUENCY_MS,
} from './mastery'
import type { Attempt } from '@/lib/curriculum/types'

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
