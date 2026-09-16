/**
 * How long a session runs.
 *
 * Twenty was a guess. Sparx targets roughly 60 minutes a week as the effective
 * dose (docs/research.md), which says the length should be a choice rather than
 * a constant — a short run before school and a longer one at the weekend are
 * different things.
 *
 * Lives in its own module so `mastery` can hold the preference without
 * importing `session`, which imports `mastery`.
 */

import type { Progress } from '@/lib/mastery/mastery'

export const SESSION_LENGTHS = [10, 20, 40] as const

export const DEFAULT_SESSION_LENGTH = 20

/**
 * The learner's chosen length, or the default.
 *
 * Saved state is not to be trusted — a mangled record must not produce a
 * session of zero problems or a thousand.
 */
export function sessionLengthOf(progress: Progress): number {
  const chosen = progress.sessionLength
  return typeof chosen === 'number' && (SESSION_LENGTHS as readonly number[]).includes(chosen)
    ? chosen
    : DEFAULT_SESSION_LENGTH
}
