import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  loadProfiles, saveProfiles, addProfile, removeProfile, renameProfile,
  progressKeyFor, adoptLegacyRecord, PROFILES_KEY,
} from './profiles'
import { STORAGE_KEY } from './storage'
import type { KeyValueStore } from './storage'

const store = (seed: Record<string, string> = {}) => {
  const data = { ...seed }
  const kv: KeyValueStore & { data: Record<string, string>; removeItem(k: string): void } = {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v },
    removeItem: (k) => { delete data[k] },
  }
  return kv
}

test('a brand new device has no profiles', () => {
  const state = loadProfiles(store())
  assert.deepEqual(state.profiles, [])
  assert.equal(state.activeId, null)
})

test('adding a profile makes it the active one', () => {
  const state = addProfile(loadProfiles(store()), 'Eddie', 'p1')
  assert.deepEqual(state.profiles.map((p) => p.name), ['Eddie'])
  assert.equal(state.activeId, 'p1')
})

test('two children on one device keep separate journeys', () => {
  let state = addProfile(loadProfiles(store()), 'Eddie', 'p1')
  state = addProfile(state, 'Ethan', 'p2')

  assert.deepEqual(state.profiles.map((p) => p.name), ['Eddie', 'Ethan'])
  assert.notEqual(progressKeyFor('p1'), progressKeyFor('p2'),
    'sharing a key is exactly the bug this fixes')
})

test('a profile key is distinct from the single-record key it replaces', () => {
  assert.notEqual(progressKeyFor('p1'), STORAGE_KEY)
})

test('profiles survive being written and read back', () => {
  const kv = store()
  const state = addProfile(addProfile(loadProfiles(kv), 'Eddie', 'p1'), 'Ethan', 'p2')
  saveProfiles(kv, state)
  assert.deepEqual(loadProfiles(kv), state)
})

test('a profile can be renamed', () => {
  const state = renameProfile(addProfile(loadProfiles(store()), 'Edie', 'p1'), 'p1', 'Eddie')
  assert.equal(state.profiles[0].name, 'Eddie')
})

test('removing a profile also removes its journey', () => {
  const kv = store()
  let state = addProfile(loadProfiles(kv), 'Eddie', 'p1')
  state = addProfile(state, 'Ethan', 'p2')
  kv.setItem(progressKeyFor('p1'), '{"facts":{}}')

  state = removeProfile(kv, state, 'p1')
  assert.deepEqual(state.profiles.map((p) => p.id), ['p2'])
  assert.equal(kv.getItem(progressKeyFor('p1')), null, 'a deleted journey must not linger')
  assert.equal(state.activeId, 'p2', 'the survivor becomes active')
})

test('removing the last profile leaves nobody active', () => {
  const kv = store()
  const state = removeProfile(kv, addProfile(loadProfiles(kv), 'Eddie', 'p1'), 'p1')
  assert.deepEqual(state.profiles, [])
  assert.equal(state.activeId, null)
})

/**
 * Two children have already been sharing one record. Throwing it away to
 * introduce profiles would delete a real journey, so the first profile adopts it.
 */
test('an existing single record becomes the first profile', () => {
  const kv = store({ [STORAGE_KEY]: '{"facts":{},"skills":{},"placed":["n-bonds-10"],"placementDone":true}' })

  const state = adoptLegacyRecord(kv, loadProfiles(kv), 'Eddie', 'p1')
  assert.deepEqual(state.profiles.map((p) => p.name), ['Eddie'])
  assert.match(kv.getItem(progressKeyFor('p1')) ?? '', /n-bonds-10/, 'the journey moved across')
  assert.equal(kv.getItem(STORAGE_KEY), null, 'and does not sit around under the old key')
})

test('adopting when there is nothing to adopt just creates the profile', () => {
  const kv = store()
  const state = adoptLegacyRecord(kv, loadProfiles(kv), 'Eddie', 'p1')
  assert.deepEqual(state.profiles.map((p) => p.name), ['Eddie'])
  assert.equal(kv.getItem(progressKeyFor('p1')), null)
})

test('adopting never runs twice over an existing profile', () => {
  const kv = store({ [STORAGE_KEY]: '{"facts":{}}' })
  let state = adoptLegacyRecord(kv, loadProfiles(kv), 'Eddie', 'p1')
  state = adoptLegacyRecord(kv, state, 'Ethan', 'p2')
  assert.deepEqual(state.profiles.map((p) => p.name), ['Eddie'],
    'the legacy record belongs to one profile, not to every new one')
})

test('corrupt profile storage degrades to no profiles rather than crashing', () => {
  for (const raw of ['', 'null', 'not json{', '[]', '{"profiles":"nope"}', '{"profiles":[1,2]}']) {
    const state = loadProfiles(store({ [PROFILES_KEY]: raw }))
    assert.ok(Array.isArray(state.profiles), `"${raw.slice(0, 16)}" produced a bad list`)
  }
})

test('an active id pointing at a profile that is gone is not honoured', () => {
  const kv = store({ [PROFILES_KEY]: '{"profiles":[{"id":"p1","name":"Eddie"}],"activeId":"ghost"}' })
  const state = loadProfiles(kv)
  assert.equal(state.activeId, 'p1', 'fall back to a real profile rather than a dangling id')
})

// ---- findings from code review --------------------------------------------

/**
 * The bug this whole feature exists to prevent. Tapping Switch persists
 * activeId: null; the repair for a dangling id could not tell that apart from
 * a deleted profile, so a reload before the next child chose dropped straight
 * back into the previous journey — and they practised into it.
 */
test('nobody chosen stays nobody chosen across a reload', () => {
  const kv = store()
  saveProfiles(kv, {
    profiles: [{ id: 'p1', name: 'Eddie' }, { id: 'p2', name: 'Ethan' }],
    activeId: null,
  })
  assert.equal(loadProfiles(kv).activeId, null,
    'handing the device over must not silently reopen the previous journey')
})

test('a chosen profile is still remembered across a reload', () => {
  const kv = store()
  saveProfiles(kv, { profiles: [{ id: 'p1', name: 'Eddie' }], activeId: 'p1' })
  assert.equal(loadProfiles(kv).activeId, 'p1')
})

test('adopting survives a storage quota that refuses writes', () => {
  const kv = store({ [STORAGE_KEY]: '{"facts":{}}' })
  const refusing = {
    ...kv,
    setItem: () => { throw new Error('QuotaExceededError') },
    removeItem: () => { throw new Error('QuotaExceededError') },
  }
  // Losing the migration is survivable; a thrown error takes down the app.
  const state = adoptLegacyRecord(refusing, loadProfiles(kv), 'Eddie', 'p1')
  assert.deepEqual(state.profiles.map((p) => p.name), ['Eddie'])
})

test('two profiles cannot share a name', () => {
  const state = addProfile(addProfile(loadProfiles(store()), 'Eddie', 'p1'), 'Eddie', 'p2')
  assert.equal(state.profiles.length, 1,
    'two identical buttons defeat the point of showing names')
})

test('a name differing only by case or spacing is still the same name', () => {
  let state = addProfile(loadProfiles(store()), 'Eddie', 'p1')
  state = addProfile(state, '  eddie ', 'p2')
  assert.equal(state.profiles.length, 1)
})

/** A shared key would mean deleting one profile wiped the other's journey. */
test('two profiles cannot share an id', () => {
  const state = addProfile(addProfile(loadProfiles(store()), 'Eddie', 'p1'), 'Ethan', 'p1')
  assert.equal(state.profiles.length, 1)
})
