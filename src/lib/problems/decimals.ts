import type { Difficulty, Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom } from './rng'
import { band, pickBand, pickFromBand } from './difficulty'
import { dec, int, problem } from './build'

/**
 * Every generator here computes in SCALED INTEGERS and converts once, via
 * `dec()`. Doing the arithmetic in floats gives `0.1 + 0.2 === 0.30000000000000004`,
 * and a maths app that marks a child wrong for being right is the one failure
 * mode that cannot be tolerated.
 */

/**
 * Percentages restricted so the result is always a whole number.
 *
 * Which percentage is asked matters more than how big the number is: 10% and
 * 50% are a shift and a halving, while 25% and 75% need a second step. The
 * level moves between those, so simple is not just "the same sum, smaller".
 */
export const fPercentOf: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const pct = pickFromBand(rng, level, [10, 50], [10, 20, 25, 50, 75], [20, 25, 75])
  // A multiple of 20 keeps every listed percentage exact.
  const n = pickBand(rng, level, [1, 15], [1, 12], [3, 15]) * 20
  return problem('f-percent-of', `${pct}% of ${n}`, int((pct * n) / 100), [pct, n])
}

export const fDecimalPlaceValue: Generator = (rng: Rng) => {
  const place = pickFrom(rng, ['tenths', 'hundredths'])
  const scaled = pick(rng, 101, 999) // always two decimal places, leading digit non-zero
  const digit = place === 'tenths' ? Math.floor(scaled / 10) % 10 : scaled % 10
  return problem(
    'f-decimal-place-value',
    `Which digit is in the ${place} place?  ${(scaled / 100).toFixed(2)}`,
    int(digit),
    [scaled],
  )
}

/**
 * Simple draws whole tenths — 3.40, not 3.47 — so the hundredths column never
 * carries. That is a real reduction in the work, not merely smaller numbers.
 */
export const fDecimalAddSub: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const draw = band(
    level,
    () => pick(rng, 11, 49) * 10,
    () => pick(rng, 101, 999),
    () => pick(rng, 501, 999),
  )
  const a = draw()
  const b = draw()
  const subtract = rng() < 0.5
  const [hi, lo] = a >= b ? [a, b] : [b, a] // keep subtraction positive
  return subtract
    ? problem('f-decimal-add-sub', `${(hi / 100).toFixed(2)} − ${(lo / 100).toFixed(2)}`, dec(hi - lo, 2), [hi, lo])
    : problem('f-decimal-add-sub', `${(a / 100).toFixed(2)} + ${(b / 100).toFixed(2)}`, dec(a + b, 2), [a, b])
}

/** One decimal place times a whole number — the product stays at one place. */
export const fDecimalMult: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const scaled = pickBand(rng, level, [11, 49], [11, 99], [51, 99]) // i.e. 1.1 to 9.9
  const whole = pickBand(rng, level, [2, 5], [2, 9], [6, 9])
  return problem(
    'f-decimal-mult',
    `${(scaled / 10).toFixed(1)} × ${whole}`,
    dec(scaled * whole, 1),
    [scaled, whole],
  )
}
