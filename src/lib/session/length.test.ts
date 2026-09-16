import { test } from 'vitest'
import assert from 'node:assert/strict'
import { SESSION_LENGTHS, DEFAULT_SESSION_LENGTH, sessionLengthOf } from './length'
import { emptyProgress, type Progress } from '@/lib/mastery/mastery'
import { loadProgress, saveProgress, type KeyValueStore } from '@/lib/mastery/storage'

test('the offered lengths are sensible and include the default', () => {
  assert.ok(SESSION_LENGTHS.includes(DEFAULT_SESSION_LENGTH))
  assert.deepEqual([...SESSION_LENGTHS].sort((a, b) => a - b), [...SESSION_LENGTHS])
  assert.ok(SESSION_LENGTHS.every((n) => n >= 5 && n <= 50), 'nothing pointless or punishing')
})

test('a learner who has never chosen gets the default', () => {
  assert.equal(sessionLengthOf(emptyProgress()), DEFAULT_SESSION_LENGTH)
})

test('a chosen length is used', () => {
  const p: Progress = { ...emptyProgress(), sessionLength: 10 }
  assert.equal(sessionLengthOf(p), 10)
})

/** Saved state is not to be trusted; a bad value must not produce a broken session. */
test('a nonsense length falls back to the default', () => {
  for (const bad of [0, -5, 1000, NaN, 3.5, null, undefined, 'twenty']) {
    const p = { ...emptyProgress(), sessionLength: bad } as unknown as Progress
    assert.equal(sessionLengthOf(p), DEFAULT_SESSION_LENGTH, `${String(bad)} should not be honoured`)
  }
})

test('a length survives being written and read back', () => {
  const data: Record<string, string> = {}
  const store: KeyValueStore = {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v },
  }
  saveProgress(store, { ...emptyProgress(), sessionLength: 40 })
  assert.equal(sessionLengthOf(loadProgress(store)), 40)
})
