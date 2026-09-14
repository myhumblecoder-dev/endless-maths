import type { Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom } from './rng'
import { dec, int, problem } from './build'

/**
 * Every generator here computes in SCALED INTEGERS and converts once, via
 * `dec()`. Doing the arithmetic in floats gives `0.1 + 0.2 === 0.30000000000000004`,
 * and a maths app that marks a child wrong for being right is the one failure
 * mode that cannot be tolerated.
 */

/** Percentages restricted so the result is always a whole number. */
export const fPercentOf: Generator = (rng: Rng) => {
  const pct = pickFrom(rng, [10, 20, 25, 50, 75])
  const n = pick(rng, 1, 12) * 20 // a multiple of 20 keeps every listed pct exact
  return problem('f-percent-of', `${pct}% of ${n}`, int((pct * n) / 100), [pct, n])
}

export const fDecimalPlaceValue: Generator = (rng: Rng) => {
  const place = pickFrom(rng, ['tenths', 'hundredths'] as const)
  const scaled = pick(rng, 101, 999) // always two decimal places, leading digit non-zero
  const digit = place === 'tenths' ? Math.floor(scaled / 10) % 10 : scaled % 10
  return problem(
    'f-decimal-place-value',
    `Which digit is in the ${place} place?  ${(scaled / 100).toFixed(2)}`,
    int(digit),
    [scaled],
  )
}

export const fDecimalAddSub: Generator = (rng: Rng) => {
  const a = pick(rng, 101, 999)
  const b = pick(rng, 101, 999)
  const subtract = rng() < 0.5
  const [hi, lo] = a >= b ? [a, b] : [b, a] // keep subtraction positive
  return subtract
    ? problem('f-decimal-add-sub', `${(hi / 100).toFixed(2)} − ${(lo / 100).toFixed(2)}`, dec(hi - lo, 2), [hi, lo])
    : problem('f-decimal-add-sub', `${(a / 100).toFixed(2)} + ${(b / 100).toFixed(2)}`, dec(a + b, 2), [a, b])
}

/** One decimal place times a whole number — the product stays at one place. */
export const fDecimalMult: Generator = (rng: Rng) => {
  const scaled = pick(rng, 11, 99) // i.e. 1.1 to 9.9
  const whole = pick(rng, 2, 9)
  return problem(
    'f-decimal-mult',
    `${(scaled / 10).toFixed(1)} × ${whole}`,
    dec(scaled * whole, 1),
    [scaled, whole],
  )
}
