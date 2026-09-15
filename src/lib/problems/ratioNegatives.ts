import type { Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom, until } from './rng'
import { choice, int, problem } from './build'
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
export const rOrderOfOps: Generator = (rng: Rng) => {
  const shape = pickFrom(rng, ['a+b*c', 'a*b+c', 'a*b-c', '(a+b)*c'] as const)
  const a = pick(rng, 2, 9)
  const b = pick(rng, 2, 9)
  const c = pick(rng, 2, 9)
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

export const rNegativeAddSub: Generator = (rng: Rng) => {
  const a = pick(rng, -20, -1)
  const b = pick(rng, 1, 20)
  const subtract = rng() < 0.5
  return subtract
    ? problem('r-negative-add-sub', `${a} − ${b}`, int(a - b), [a, b])
    : problem('r-negative-add-sub', `${a} + ${b}`, int(a + b), [a, b])
}

/** Division is generated backwards so it stays exact. */
export const rNegativeMulDiv: Generator = (rng: Rng) => {
  const a = pick(rng, 2, 12) * (rng() < 0.5 ? -1 : 1)
  const b = pick(rng, 2, 12) * (rng() < 0.5 ? -1 : 1)
  return rng() < 0.5
    ? problem('r-negative-mul-div', `${a} × ${b}`, int(a * b), [a, b])
    : problem('r-negative-mul-div', `${a * b} ÷ ${a}`, int(b), [a * b, a])
}

/**
 * Proportion, scaled by a whole number so the answer stays an integer. A
 * non-integer scale factor is a harder skill and belongs to the fractions
 * strand, not here.
 */
export const rProportion: Generator = (rng: Rng) => {
  const unit = pick(rng, 2, 12)
  const n1 = pick(rng, 2, 6)
  const n2 = pick(rng, 2, 9)
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
export const rRatioSimplify: Generator = (rng: Rng) => {
  const base = until(
    () => ({ a: pick(rng, 1, 9), b: pick(rng, 1, 9) }),
    ({ a, b }) => gcd(a, b) === 1 && a !== b,
  )
  const factor = pick(rng, 2, 6)
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
export const rFactorsMultiples: Generator = (rng: Rng) => {
  const wantHighest = rng() < 0.5

  // A shared factor by construction, so "highest common factor" is never a
  // pointless 1, and the multiple stays small enough to work out mentally.
  const shared = pick(rng, 2, 9)
  const { x, y } = until(
    () => ({ x: shared * pick(rng, 2, 9), y: shared * pick(rng, 2, 9) }),
    ({ x, y }) => x !== y && (x * y) / gcd(x, y) <= 400,
  )

  return wantHighest
    ? problem('r-factors-multiples', `Highest common factor of ${x} and ${y}`, int(gcd(x, y)), [x, y])
    : problem('r-factors-multiples', `Lowest common multiple of ${x} and ${y}`, int((x * y) / gcd(x, y)), [x, y])
}
