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
  createdAt: number
}

export type ProfileState = {
  profiles: Profile[]
  activeId: string | null
}

/** A store that can also forget, which deleting a profile needs. */
export type ProfileStore = KeyValueStore & { removeItem(key: string): void }

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

    // An id pointing at a profile that no longer exists would leave the app
    // with an active profile it cannot load.
    const active = valid.some((p) => p.id === activeId)
      ? (activeId as string)
      : (valid[0]?.id ?? null)

    return { profiles: valid, activeId: active }
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

export function addProfile(state: ProfileState, name: string, id: string): ProfileState {
  return {
    profiles: [...state.profiles, { id, name, createdAt: 0 }],
    // A newly added profile is the one about to be used.
    activeId: id,
  }
}

export function renameProfile(state: ProfileState, id: string, name: string): ProfileState {
  return {
    ...state,
    profiles: state.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
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
    activeId: state.activeId === id ? (profiles[0]?.id ?? null) : state.activeId,
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

  const legacy = store.getItem(STORAGE_KEY)
  if (legacy !== null) {
    store.setItem(progressKeyFor(id), legacy)
    try {
      store.removeItem(STORAGE_KEY)
    } catch {
      // Leaving it behind is untidy but harmless; it is no longer read.
    }
  }

  return addProfile(state, name, id)
}
