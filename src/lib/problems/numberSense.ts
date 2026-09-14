import type { Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom, until } from './rng'
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
    const places = max === 100 ? (['tens', 'ones'] as const) : (['hundreds', 'tens', 'ones'] as const)
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
 */
export const nRound: Generator = (rng: Rng) => {
  const to = pickFrom(rng, [10, 100])
  const n = until(
    () => pick(rng, to === 10 ? 11 : 101, to === 10 ? 99 : 999),
    (v) => v % to !== to / 2,
  )
  return problem('n-round', `Round ${n} to the nearest ${to}`, int(Math.round(n / to) * to), [n, to])
}
