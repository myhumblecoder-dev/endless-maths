/**
 * Several children on one device.
 *
 * `localStorage` is per-browser, not per-person, so a single record meant two
 * brothers overwrote each other: the second to sit down inherited the first
 * one's placement and mastery. Each profile now has its own journey under its
 * own key.
 *
 * Names live here and never leave. They exist so a child recognises their own
 * profile; anything crossing the device boundary carries the id instead. See
 * docs/design.md, "What may leave the device".
 */

import { STORAGE_KEY, type KeyValueStore } from './storage'

export const PROFILES_KEY = 'endless-maths:profiles:v1'

export type Profile = {
  id: string
  /** Local only. Stripped from anything that leaves the device. */
  name: string
}

export type ProfileState = {
  profiles: Profile[]
  activeId: string | null
}

/** A store that can also forget, which deleting a profile needs. */
export type ProfileStore = KeyValueStore & {
  removeItem(key: string): void
  /** Optional: lets a reset sweep everything this app owns. */
  keys?: () => string[]
}

/** Everything this app stores lives under one prefix, which a reset can sweep. */
const KEY_PREFIX = 'endless-maths:'

const EMPTY: ProfileState = { profiles: [], activeId: null }

export const progressKeyFor = (profileId: string): string =>
  `endless-maths:progress:v1:${profileId}`

function isProfile(v: unknown): v is Profile {
  if (typeof v !== 'object' || v === null) return false
  const { id, name } = v as Partial<Profile>
  return typeof id === 'string' && typeof name === 'string'
}

/** Never throws. Losing the profile list is bad; a blank screen is worse. */
export function loadProfiles(store: KeyValueStore): ProfileState {
  try {
    const raw = store.getItem(PROFILES_KEY)
    if (!raw) return EMPTY

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return EMPTY

    const { profiles, activeId } = parsed as Partial<ProfileState>
    const valid = Array.isArray(profiles) ? profiles.filter(isProfile) : []

    /**
     * Repair a DANGLING id only — one naming a profile that has been deleted.
     *
     * A deliberate `null` means somebody tapped Switch and the next child has
     * not chosen yet. Treating that as dangling and "repairing" it to the first
     * profile reopened the previous journey on reload, and the next child
     * practised into it: exactly the mixing this whole module exists to stop.
     */
    // Anything that is not a string is not an id. A number would build a
    // nonsense storage key and a Switch button with no name on it.
    const chosen = typeof activeId === 'string' ? activeId : null
    const dangling = chosen !== null && !valid.some((p) => p.id === chosen)
    return { profiles: valid, activeId: dangling ? (valid[0]?.id ?? null) : chosen }
  } catch {
    return EMPTY
  }
}

/** Never throws — a full quota must not stop anyone practising. */
export function saveProfiles(store: KeyValueStore, state: ProfileState): void {
  try {
    store.setItem(PROFILES_KEY, JSON.stringify(state))
  } catch {
    // Survivable: the session continues in memory.
  }
}

/** Names match on trimmed case-insensitive text: "  eddie " is Eddie. */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function addProfile(state: ProfileState, name: string, id: string): ProfileState {
  const trimmed = name.trim()

  /**
   * Two profiles called "Eddie" render as two identical buttons, which defeats
   * the point of showing names at all. A duplicate id is worse: they would
   * share a progress key, and deleting one would wipe the other's journey.
   */
  const clashes =
    state.profiles.some((p) => p.id === id) ||
    state.profiles.some((p) => sameName(p.name, trimmed))
  if (clashes) return state

  return {
    profiles: [...state.profiles, { id, name: trimmed }],
    // A newly added profile is the one about to be used.
    activeId: id,
  }
}

/** Same rules as adding: trimmed, and never a duplicate of someone else. */
export function renameProfile(state: ProfileState, id: string, name: string): ProfileState {
  const trimmed = name.trim()
  if (trimmed === '') return state
  if (state.profiles.some((p) => p.id !== id && sameName(p.name, trimmed))) return state

  return {
    ...state,
    profiles: state.profiles.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
  }
}

/** Removes the profile and its journey — this destroys data, so ask first. */
export function removeProfile(
  store: ProfileStore,
  state: ProfileState,
  id: string,
): ProfileState {
  try {
    store.removeItem(progressKeyFor(id))
  } catch {
    // Nothing useful to do; the profile still goes.
  }

  const profiles = state.profiles.filter((p) => p.id !== id)
  return {
    profiles,
    // Deleting whoever was using the device asks who is practising rather than
    // silently continuing into a sibling's journey.
    activeId: state.activeId === id ? null : state.activeId,
  }
}

/**
 * Give an existing single record to the first profile.
 *
 * Two children had already been sharing one record before profiles existed.
 * Introducing them by throwing it away would delete a real journey, so the
 * first profile adopts it — once, and never over an existing profile.
 */
export function adoptLegacyRecord(
  store: ProfileStore,
  state: ProfileState,
  name: string,
  id: string,
): ProfileState {
  if (state.profiles.length > 0) return state

  /**
   * Never throws, like everything else that touches storage. On a device with
   * no quota left — Safari private mode refuses every write — losing the
   * migration is survivable, while an exception escaping into the React tree
   * is a blank app.
   */
  try {
    const legacy = store.getItem(STORAGE_KEY)
    if (legacy !== null) {
      store.setItem(progressKeyFor(id), legacy)
      store.removeItem(STORAGE_KEY)
    }
  } catch {
    // The profile is still created; only the old journey is left behind.
  }

  return addProfile(state, name, id)
}

/**
 * Clear whatever made the app crash, and nothing more than necessary.
 *
 * This is what the crash screen's "Start again" calls. It removes the journey
 * of whoever was using the device and deselects them, so the reload lands on
 * the picker rather than straight back into the record that threw. A sibling's
 * journey is not collateral damage.
 *
 * If the profile list itself cannot be read, there is nothing to be targeted
 * about, so everything this app owns goes.
 */
export function resetAfterCrash(store: ProfileStore): void {
  try {
    const raw = store.getItem(PROFILES_KEY)
    if (raw !== null) JSON.parse(raw) // throws if the list itself is the problem

    const state = loadProfiles(store)
    if (state.activeId) {
      store.removeItem(progressKeyFor(state.activeId))
      saveProfiles(store, { ...state, activeId: null })
      return
    }
    // Nobody is using the device, so there is nothing to be targeted about —
    // fall through and sweep, which also clears any pre-profiles record.
  } catch {
    // Fall through to the clean slate below.
  }

  try {
    const owned = store.keys?.().filter((k) => k.startsWith(KEY_PREFIX))
      ?? [PROFILES_KEY, STORAGE_KEY]
    for (const key of owned) store.removeItem(key)
  } catch {
    // Nothing further to try; the reload is still worth attempting.
  }
}
