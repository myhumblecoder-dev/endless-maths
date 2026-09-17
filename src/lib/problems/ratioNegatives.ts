import type { Difficulty, Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom, until } from './rng'
import { band, pickBand, pickFromBand, rangeBand } from './difficulty'
import { choice, int, numeral, problem } from './build'
import { gcd, simplify } from './fraction'

const PRIMES_TO_100 = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47,
  53, 59, 61, 67, 71, 73, 79, 83, 89, 97] as const

/** Yes/no, so the answer is a `choice`. Half the draws are prime by construction. */
export const rPrimes: Generator = (rng: Rng) => {
  const isPrime = rng() < 0.5
  const n = isPrime
    ? pickFrom(rng, PRIMES_TO_100)
    : pickFrom(rng, [4, 6, 8, 9, 12, 15, 16, 21, 25, 27, 33, 35, 39, 49, 51, 55, 63, 77, 81, 91])
  return problem('r-primes', `Is ${n} a prime number?`, choice(isPrime ? 'yes' : 'no', ['yes', 'no']), [n], `prime:${n}`)
}

export const rSquares: Generator = (rng: Rng) => {
  const n = pick(rng, 2, 15)
  return problem('r-squares', `${n}²`, int(n * n), [n], `sq:${n}`)
}

/**
 * Order of operations. Division is excluded and subtraction is ordered to stay
 * positive, so a child at this stage never meets a fraction or a negative they
 * have not been taught yet — those are separate skills further along the graph.
 */
export const rOrderOfOps: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  // Simple omits the bracketed shape and the subtraction: the point at that
  // level is only that multiplication goes first.
  const shape = pickFromBand(
    rng,
    level,
    ['a+b*c', 'a*b+c'] as const,
    ['a+b*c', 'a*b+c', 'a*b-c', '(a+b)*c'] as const,
    ['a*b-c', '(a+b)*c', 'a+b*c'] as const,
  )
  const [lo, hi] = rangeBand(level, [2, 5], [2, 9], [6, 12])
  const a = pick(rng, lo, hi)
  const b = pick(rng, lo, hi)
  const c = pick(rng, lo, hi)
  switch (shape) {
    case 'a+b*c':
      return problem('r-order-of-ops', `${a} + ${b} × ${c}`, int(a + b * c), [a, b, c])
    case 'a*b+c':
      return problem('r-order-of-ops', `${a} × ${b} + ${c}`, int(a * b + c), [a, b, c])
    case 'a*b-c':
      return problem('r-order-of-ops', `${a} × ${b} − ${c}`, int(a * b - c), [a, b, c])
    default:
      return problem('r-order-of-ops', `(${a} + ${b}) × ${c}`, int((a + b) * c), [a, b, c])
  }
}

export const rNegativeAddSub: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const [lo, hi] = rangeBand(level, [1, 9], [1, 20], [12, 50])
  const a = -pick(rng, lo, hi)
  const b = pick(rng, lo, hi)
  const subtract = rng() < 0.5
  return subtract
    ? problem('r-negative-add-sub', `${numeral(a)} − ${b}`, int(a - b), [a, b])
    : problem('r-negative-add-sub', `${numeral(a)} + ${b}`, int(a + b), [a, b])
}

/** Division is generated backwards so it stays exact. */
export const rNegativeMulDiv: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const [lo, hi] = rangeBand(level, [2, 5], [2, 12], [6, 12])
  const a = pick(rng, lo, hi) * (rng() < 0.5 ? -1 : 1)
  const b = pick(rng, lo, hi) * (rng() < 0.5 ? -1 : 1)
  return rng() < 0.5
    ? problem('r-negative-mul-div', `${numeral(a)} × ${numeral(b)}`, int(a * b), [a, b])
    : problem('r-negative-mul-div', `${numeral(a * b)} ÷ ${numeral(a)}`, int(b), [a * b, a])
}

/**
 * Proportion, scaled by a whole number so the answer stays an integer. A
 * non-integer scale factor is a harder skill and belongs to the fractions
 * strand, not here.
 */
export const rProportion: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const unit = pickBand(rng, level, [2, 5], [2, 12], [7, 15])
  const n1 = pickBand(rng, level, [2, 4], [2, 6], [4, 9])
  const n2 = pickBand(rng, level, [2, 6], [2, 9], [7, 15])
  return problem(
    'r-proportion',
    `If ${n1} pencils cost ${n1 * unit}p, what do ${n2} pencils cost?`,
    int(n2 * unit),
    [n1, n1 * unit, n2],
  )
}

/**
 * Simplifying a ratio.
 *
 * Always poses a ratio that genuinely needs work — an already-simplified one
 * would leave nothing to do. Restating the question grades as
 * equivalent-unsimplified rather than wrong, exactly as an unsimplified
 * fraction does; see docs/design.md.
 */
export const rRatioSimplify: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const [lo, hi] = rangeBand(level, [1, 5], [1, 9], [3, 9])
  const base = until(
    () => ({ a: pick(rng, lo, hi), b: pick(rng, lo, hi) }),
    ({ a, b }) => gcd(a, b) === 1 && a !== b,
  )
  const factor = pickBand(rng, level, [2, 3], [2, 6], [4, 9])
  const reduced = simplify(base.a, base.b)
  return problem(
    'r-ratio-simplify',
    `Simplify ${base.a * factor} : ${base.b * factor}`,
    { kind: 'parts', parts: [reduced.num, reduced.den], separator: ':' },
    [base.a * factor, base.b * factor],
  )
}

/**
 * Factors and multiples, asked as highest common factor and lowest common
 * multiple — both of which have one whole-number answer.
 *
 * Listing every factor of 24 is a Year 5 activity and would need a long
 * comma-separated entry. HCF and LCM are what an 11- to 13-year-old actually
 * does, and they are precisely what adding fractions with unlike denominators
 * depends on.
 */
export const rFactorsMultiples: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const wantHighest = rng() < 0.5

  // A shared factor by construction, so "highest common factor" is never a
  // pointless 1, and the multiple stays small enough to work out mentally.
  const shared = pickBand(rng, level, [2, 4], [2, 9], [5, 12])
  const [lo, hi] = rangeBand(level, [2, 5], [2, 9], [4, 12])
  const limit = band(level, 120, 400, 900)
  const { x, y } = until(
    () => ({ x: shared * pick(rng, lo, hi), y: shared * pick(rng, lo, hi) }),
    ({ x, y }) => x !== y && (x * y) / gcd(x, y) <= limit,
  )

  return wantHighest
    ? problem('r-factors-multiples', `Highest common factor of ${x} and ${y}`, int(gcd(x, y)), [x, y])
    : problem('r-factors-multiples', `Lowest common multiple of ${x} and ${y}`, int((x * y) / gcd(x, y)), [x, y])
}
