/**
 * How hard a topic is asked, within the topic.
 *
 * Difficulty already existed in two places before this. **Between** topics, the
 * skill graph is the difficulty system: 2/5/10 comes before 3/4 comes before
 * 6/7/8/9, and addition without carrying is a different node from addition with
 * it. **Within fact topics**, every fact carries its own Leitner box and its own
 * recall speed, which individuates more finely than three bands ever could.
 *
 * What was missing is the middle: a procedure topic like `a-add-3digit` drew
 * from one fixed band, so a child who could not do it had nowhere to stand and a
 * child who found it easy had nowhere to go. This is that dial.
 *
 * It exists because of the session rules. A child is given their weakest topic
 * and must reach 90%; if they hit the question cap instead, the level drops so
 * the next attempt is a fair fight. The topic still stays their weakest — see
 * docs/design.md.
 */

import type { Difficulty, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom } from './rng'

export type { Difficulty }

/** Easiest first. Order is load-bearing: `easier` and `harder` walk it. */
export const DIFFICULTIES = ['simple', 'medium', 'difficult'] as const

/** The level a topic is asked at until something moves it. */
export const DEFAULT_DIFFICULTY: Difficulty = 'medium'

const step = (level: Difficulty, by: number): Difficulty => {
  const at = DIFFICULTIES.indexOf(level)
  // Clamped rather than wrapped: falling off the bottom of "simple" into
  // "difficult" would be the cruellest possible bug in this file.
  return DIFFICULTIES[Math.min(DIFFICULTIES.length - 1, Math.max(0, at + by))]
}

export const easier = (level: Difficulty): Difficulty => step(level, -1)
export const harder = (level: Difficulty): Difficulty => step(level, +1)

/**
 * Which topics actually honour the level.
 *
 * Facts are absent on purpose: `7 × 8` is not an easier or harder version of
 * anything, it is one fact among a hundred, already scheduled individually. So
 * are the topics whose whole identity is a difficulty split — `a-add-2digit`
 * versus `a-add-2digit-regroup` — where a second dial would just blur the line
 * the split exists to draw.
 *
 * This list is not decoration. The app tells a child when it has made a topic
 * easier, and saying so without doing so is worse than not saying it.
 */
const VARIED: ReadonlySet<string> = new Set([
  'n-round',
  'a-add-3digit', 'a-sub-3digit',
  'm-2digit-x-1digit', 'm-div-remainder', 'm-long-mult', 'm-long-div',
  'r-order-of-ops', 'r-negative-add-sub', 'r-negative-mul-div',
  'r-proportion', 'r-ratio-simplify', 'r-factors-multiples',
  'f-equivalent', 'f-compare', 'f-add-like', 'f-sub-like', 'f-add-unlike',
  'f-multiply', 'f-divide', 'f-convert-fdp',
  'f-percent-of', 'f-decimal-add-sub', 'f-decimal-mult',
  'p-evaluate', 'p-like-terms', 'p-distribute', 'p-inequalities',
  'p-solve-one-step', 'p-solve-two-step', 'p-solve-both-sides', 'p-formula',
])

export const isVaried = (skill: string): boolean => VARIED.has(skill)

/**
 * Pick the value for this level out of three.
 *
 * Generators read as maths, and three-branch conditionals in the middle of them
 * do not. `band(level, small, usual, large)` keeps each generator one
 * expression per quantity.
 */
export function band<T>(level: Difficulty, simple: T, medium: T, difficult: T): T {
  return level === 'simple' ? simple : level === 'difficult' ? difficult : medium
}

/** An inclusive `[lo, hi]`, matching what `pick` takes. */
export type Range = readonly [number, number]

/** `band` for ranges, which need the tuple shape kept rather than widened. */
export const rangeBand = (level: Difficulty, simple: Range, medium: Range, difficult: Range): Range =>
  band(level, simple, medium, difficult)

/** Draw from this level's range — the commonest thing a generator does. */
export const pickBand = (rng: Rng, level: Difficulty, simple: Range, medium: Range, difficult: Range): number =>
  pick(rng, ...rangeBand(level, simple, medium, difficult))

/** Draw from this level's list, for the skills whose difficulty is a choice. */
export const pickFromBand = <T>(
  rng: Rng,
  level: Difficulty,
  simple: readonly T[],
  medium: readonly T[],
  difficult: readonly T[],
): T => pickFrom(rng, band(level, simple, medium, difficult))
