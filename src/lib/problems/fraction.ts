/**
 * Fraction arithmetic, kept in integers throughout.
 *
 * Nothing here converts to a decimal. `1/3` has no exact decimal, so comparing
 * fractions by their floating-point value would eventually mark a correct
 * answer wrong — the one failure this app cannot afford. Equality is decided by
 * cross-multiplication of whole numbers instead.
 */

export type Ratio = { num: number; den: number }

/** Euclid. Sign-independent, and `gcd(0, n) === n`. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) [x, y] = [y, x % y]
  return x
}

/**
 * Lowest terms, with the sign normalised onto the numerator so that `6/-8` and
 * `-6/8` compare identically.
 */
export function simplify(num: number, den: number): Ratio {
  if (den === 0) return { num, den: 0 }
  if (num === 0) return { num: 0, den: 1 }

  const sign = den < 0 ? -1 : 1
  const divisor = gcd(num, den) || 1
  return { num: (sign * num) / divisor, den: (sign * den) / divisor }
}

export const isSimplified = (num: number, den: number): boolean => {
  const s = simplify(num, den)
  return s.num === num && s.den === den
}

/**
 * Read what the learner typed. Accepts `3/4`, `-3/4`, `1 3/4`, `-1 3/4` and a
 * bare whole number; returns `undefined` for anything else, including a zero
 * denominator, so the caller can grade it incorrect rather than crash.
 *
 * A mixed number becomes improper, because comparing `1 3/4` with `7/4` should
 * not depend on which form the learner happened to use.
 */
export function parseFraction(text: string): Ratio | undefined {
  const raw = text.trim().replace(/−/g, '-')
  if (raw === '') return undefined

  const mixed = raw.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) {
    const whole = Number(mixed[1])
    const num = Number(mixed[2])
    const den = Number(mixed[3])
    if (den === 0) return undefined
    // The whole part carries the sign: -1 3/4 is -(1 + 3/4), not -1 + 3/4.
    const magnitude = Math.abs(whole) * den + num
    return { num: whole < 0 ? -magnitude : magnitude, den }
  }

  const simple = raw.match(/^(-?\d+)\/(-?\d+)$/)
  if (simple) {
    const den = Number(simple[2])
    return den === 0 ? undefined : { num: Number(simple[1]), den }
  }

  const whole = raw.match(/^-?\d+$/)
  if (whole) return { num: Number(raw), den: 1 }

  return undefined
}

/** Equal by cross-multiplication, never by decimal value. */
export const sameValue = (a: Ratio, b: Ratio): boolean => a.num * b.den === b.num * a.den
