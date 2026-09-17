import { test } from 'vitest'
import assert from 'node:assert/strict'
import { difficultyFor, setDifficulty, easeOff, stepUp, provenAt, recordPass } from './levels'
import { emptyProgress } from './mastery'
import { loadProgress, saveProgress, type KeyValueStore } from './storage'

const store = (seed: Record<string, string> = {}): KeyValueStore => {
  const data = { ...seed }
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v } }
}

test('a topic nobody has struggled with is asked at medium', () => {
  assert.equal(difficultyFor(emptyProgress(), 'a-add-3digit'), 'medium')
})

test('a level that has been set is the one that is used', () => {
  const p = setDifficulty(emptyProgress(), 'a-add-3digit', 'simple')
  assert.equal(difficultyFor(p, 'a-add-3digit'), 'simple')
})

test('setting one topic leaves every other topic alone', () => {
  const p = setDifficulty(emptyProgress(), 'a-add-3digit', 'simple')
  assert.equal(difficultyFor(p, 'p-solve-two-step'), 'medium',
    'struggling with one thing says nothing about another')
})

test('levels survive a save and a reload', () => {
  const kv = store()
  saveProgress(kv, setDifficulty(emptyProgress(), 'p-solve-two-step', 'simple'))
  assert.equal(difficultyFor(loadProgress(kv), 'p-solve-two-step'), 'simple',
    'a child who was given an easier version yesterday must still have it today')
})

/**
 * Hitting the cap means they ran out of questions, not patience. Next time the
 * same topic comes round it should be a fair fight — but it is still the same
 * topic. See docs/design.md.
 */
test('easing off drops one level and stops at simple', () => {
  let p = easeOff(emptyProgress(), 'a-add-3digit')
  assert.equal(difficultyFor(p, 'a-add-3digit'), 'simple')

  p = easeOff(p, 'a-add-3digit')
  assert.equal(difficultyFor(p, 'a-add-3digit'), 'simple', 'there is no floor below simple')
})

test('stepping up rises one level and stops at difficult', () => {
  let p = stepUp(emptyProgress(), 'a-add-3digit')
  assert.equal(difficultyFor(p, 'a-add-3digit'), 'difficult')

  p = stepUp(p, 'a-add-3digit')
  assert.equal(difficultyFor(p, 'a-add-3digit'), 'difficult')
})

/**
 * Telling a child their work just got easier, and then handing them the
 * identical questions, is worse than saying nothing.
 */
test('a topic with no easier version is never claimed to have one', () => {
  const before = emptyProgress()
  const after = easeOff(before, 'm-times-6-7-8-9')
  assert.equal(after, before, 'times tables have no simple band — leave it untouched')
  assert.equal(difficultyFor(after, 'm-times-6-7-8-9'), 'medium')
})

test('a corrupt level in storage falls back to medium rather than crashing', () => {
  const kv = store()
  saveProgress(kv, { ...emptyProgress(), levels: { 'a-add-3digit': 'impossible' } } as never)
  assert.equal(difficultyFor(loadProgress(kv), 'a-add-3digit'), 'medium')
})

test('a record written before levels existed still loads', () => {
  const kv = store()
  saveProgress(kv, emptyProgress())
  assert.doesNotThrow(() => difficultyFor(loadProgress(kv), 'a-add-3digit'))
})

// ---- what they have proved, as against what comes next ---------------------

test('a topic nobody has passed has nothing recorded', () => {
  assert.equal(provenAt(emptyProgress(), 'a-add-3digit'), undefined)
})

test('what they passed at is remembered separately from what comes next', () => {
  let p = recordPass(emptyProgress(), 'a-add-3digit', 'simple')
  p = setDifficulty(p, 'a-add-3digit', 'medium')

  assert.equal(provenAt(p, 'a-add-3digit'), 'simple', 'what they have actually done')
  assert.equal(difficultyFor(p, 'a-add-3digit'), 'medium', 'what they will be asked next')
})

test('a pass survives a save and a reload', () => {
  const kv = store()
  saveProgress(kv, recordPass(emptyProgress(), 'a-add-3digit', 'simple'))
  assert.equal(provenAt(loadProgress(kv), 'a-add-3digit'), 'simple')
})

test('a corrupt pass falls back to nothing recorded rather than crashing', () => {
  const kv = store()
  saveProgress(kv, { ...emptyProgress(), proven: { 'a-add-3digit': 'nonsense' } } as never)
  assert.equal(provenAt(loadProgress(kv), 'a-add-3digit'), undefined)
})

test('a topic with no levels records nothing to prove', () => {
  const p = recordPass(emptyProgress(), 'm-times-6-7-8-9', 'medium')
  assert.equal(provenAt(p, 'm-times-6-7-8-9'), undefined,
    'a times table has one band — there is nothing to have proved it at')
})
