import type { Difficulty, Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom, until } from './rng'
import { pickFromBand } from './difficulty'
import { choice, int, problem } from './build'

/** `4 + ? = 10` — a fact, because the bonds to 10 are a memorizable set of ten. */
export const nBonds10: Generator = (rng: Rng) => {
  const a = pick(rng, 1, 9)
  return problem('n-bonds-10', `${a} + ? = 10`, int(10 - a), [a], `bond10:${a}`)
}

/** Comparison needs three buttons, not a keypad — hence the `choice` answer. */
export const nCompare20: Generator = (rng: Rng) => {
  const a = pick(rng, 1, 20)
  const b = pick(rng, 1, 20)
  const sign = a > b ? '>' : a < b ? '<' : '='
  return problem('n-compare-20', `${a} ? ${b}`, choice(sign, ['<', '=', '>']), [a, b])
}

const placeValue = (skill: 'n-place-value-100' | 'n-place-value-1000', max: number): Generator =>
  (rng: Rng) => {
    const places = max === 100 ? (['tens', 'ones']) : (['hundreds', 'tens', 'ones'])
    const place = pickFrom(rng, places)
    // Lower bound keeps the leading digit non-zero, so "hundreds" is never a trick question.
    const n = pick(rng, max / 10, max - 1)
    const digit = place === 'ones' ? n % 10 : place === 'tens' ? Math.floor(n / 10) % 10 : Math.floor(n / 100) % 10
    return problem(skill, `Which digit is in the ${place} place?  ${n}`, int(digit), [n])
  }

export const nPlaceValue100 = placeValue('n-place-value-100', 100)
export const nPlaceValue1000 = placeValue('n-place-value-1000', 1000)

/**
 * Rounding. Numbers ending in 5 are excluded: "round half up" is a convention,
 * not a truth, and a child who rounds 25 down to 20 has not made a mistake.
 *
 * The level changes what you round TO, not just how big the number is. Rounding
 * 4,382 to the nearest thousand is a different act from rounding 47 to the
 * nearest ten, and bigger numbers alone would not have got there.
 */
export const nRound: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const to = pickFromBand(rng, level, [10], [10, 100], [100, 1000])
  const [lo, hi] = to === 10 ? [11, 99] : to === 100 ? [101, 999] : [1001, 9999]
  const n = until(() => pick(rng, lo, hi), (v) => v % to !== to / 2)
  return problem('n-round', `Round ${n} to the nearest ${to}`, int(Math.round(n / to) * to), [n, to])
}
