import type { Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom } from './rng'
import { choice, int, problem } from './build'

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
