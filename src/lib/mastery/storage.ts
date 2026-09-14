/**
 * Persistence. `localStorage` and nothing else — see docs/design.md § Four
 * things that shape everything else. A child's history never leaves the device.
 *
 * The store is injected rather than reached for globally, so this is testable
 * without a DOM and so a future profile switcher can hand in a namespaced view.
 */

import { emptyProgress, type Progress } from './mastery'

export const STORAGE_KEY = 'endless-maths:progress:v1'

/** The slice of `localStorage` this needs. */
export type KeyValueStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function isProgress(v: unknown): v is Progress {
  if (typeof v !== 'object' || v === null) return false
  const { facts, skills } = v as Partial<Progress>
  const plainObject = (x: unknown) => typeof x === 'object' && x !== null && !Array.isArray(x)
  return plainObject(facts) && plainObject(skills)
}

/** `placed` arrived after v1 shipped; treat a record without it as unplaced. */
const normalise = (p: Progress): Progress => ({
  ...p,
  placed: Array.isArray(p.placed) ? p.placed : [],
  placementDone: p.placementDone === true,
})

/**
 * Never throws. A mangled record costs the child their history, which is
 * recoverable; a thrown error mid-session costs them the app, which is not.
 */
export function loadProgress(store: KeyValueStore): Progress {
  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed: unknown = JSON.parse(raw)
    return isProgress(parsed) ? normalise(parsed) : emptyProgress()
  } catch {
    return emptyProgress()
  }
}

/** Also never throws — private browsing and full quotas must not stop practice. */
export function saveProgress(store: KeyValueStore, progress: Progress): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Losing the save is survivable; the session continues in memory.
  }
}

/** `localStorage` when there is a window, otherwise a no-op for SSR. */
export function browserStore(): KeyValueStore {
  if (typeof window === 'undefined') {
    return { getItem: () => null, setItem: () => {} }
  }
  return window.localStorage
}
