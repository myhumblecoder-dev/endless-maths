/**
 * Seeded, deterministic randomness. See docs/design.md.
 *
 * Seeded rather than `Math.random()` so a session is reproducible: the same
 * seed yields the same problems, which makes bugs reportable ("problem 7 of
 * seed 12345 was wrong") and lets a teacher hand the same set to a whole class.
 */

import type { Rng } from '@/lib/curriculum/types'

/** mulberry32 — small, fast, good enough for picking numbers. Not cryptographic. */
export function seeded(seed: number): Rng {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Inclusive on both ends. */
export function pick(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1))
}

export function pickFrom<T>(rng: Rng, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)]
}

/**
 * Retry until the candidate satisfies `ok`.
 *
 * Several skills are defined by a constraint the straightforward draw does not
 * guarantee — "must require carrying", "must divide exactly". Rejection
 * sampling keeps those generators readable. Every use must have a generous
 * acceptance rate; the throw is a tripwire for a constraint that can never be
 * met, which would otherwise hang the browser.
 */
export function until<T>(make: () => T, ok: (v: T) => boolean, tries = 200): T {
  for (let i = 0; i < tries; i++) {
    const v = make()
    if (ok(v)) return v
  }
  throw new Error('generator constraint unsatisfiable after 200 attempts')
}
