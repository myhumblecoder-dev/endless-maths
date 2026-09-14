import { test } from 'vitest'
import assert from 'node:assert/strict'
import { loadProgress, saveProgress, STORAGE_KEY, type KeyValueStore } from './storage'
import { emptyProgress, record } from './mastery'

const fake = (seed: Record<string, string> = {}): KeyValueStore => {
  const data = { ...seed }
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v },
  }
}

const someProgress = () =>
  record(emptyProgress(), {
    problemId: 'a-add-within-10#3,4', skill: 'a-add-within-10', factKey: 'add:3+4',
    given: '7', verdict: 'correct', elapsedMs: 900, at: 123,
  })

test('progress survives a round trip', () => {
  const store = fake()
  const p = someProgress()
  saveProgress(store, p)
  assert.deepEqual(loadProgress(store), p)
})

test('a first-time learner loads empty progress', () => {
  assert.deepEqual(loadProgress(fake()), emptyProgress())
})

/**
 * A child mid-session must never see a crash because storage got mangled —
 * losing history is recoverable, a white screen is not.
 */
test('corrupt storage degrades to a fresh start, not a crash', () => {
  assert.deepEqual(loadProgress(fake({ [STORAGE_KEY]: 'not json{{{' })), emptyProgress())
})

test('storage of the wrong shape degrades to a fresh start', () => {
  assert.deepEqual(loadProgress(fake({ [STORAGE_KEY]: '[1,2,3]' })), emptyProgress())
  assert.deepEqual(loadProgress(fake({ [STORAGE_KEY]: '{"facts":"nope"}' })), emptyProgress())
  assert.deepEqual(loadProgress(fake({ [STORAGE_KEY]: 'null' })), emptyProgress())
})

test('saving never throws when storage is unavailable', () => {
  const blocked: KeyValueStore = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError') },
  }
  assert.doesNotThrow(() => saveProgress(blocked, someProgress()), 'private browsing must not break practice')
})
