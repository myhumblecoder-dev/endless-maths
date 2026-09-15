import type { Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom, until } from './rng'
import { choice, int, problem } from './build'
import { gcd } from './fraction'

/**
 * The fractions strand. Denominators are kept to the ones that actually come up
 * in Year 5-7 work rather than any number, so the arithmetic stays mental.
 */
const DENOMINATORS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12] as const

/**
 * Naming a fraction needs the answer already in lowest terms, which thins the
 * pool badly on small denominators — 4 offers only 1/4 and 3/4. Sevenths and
 * ninths are there to widen it, since a session of twenty refuses to repeat a
 * question.
 */

/** A proper fraction already in lowest terms. */
function properSimplified(rng: Rng): { num: number; den: number } {
  return until(
    () => {
      const den = pickFrom(rng, DENOMINATORS)
      return { num: pick(rng, 1, den - 1), den }
    },
    ({ num, den }) => gcd(num, den) === 1,
  )
}

/**
 * Naming a fraction. The answer is always already in lowest terms — otherwise
 * the correct answer would itself grade as `equivalent-unsimplified`, which
 * would be absurd on the skill that introduces fractions.
 */
export const fIdentify: Generator = (rng: Rng) => {
  const { num, den } = properSimplified(rng)
  return problem('f-identify', `What fraction is ${num} out of ${den}?`, { kind: 'fraction', num, den }, [num, den])
}

/**
 * Equivalent fractions, asked as a missing numerator so the answer is a whole
 * number: `3/4 = ?/8`.
 *
 * Asking for `6/8` directly would collide with the simplify-everything policy —
 * the expected answer would grade as `equivalent-unsimplified` against itself.
 * A missing numerator sidesteps that entirely, and is how textbooks ask it.
 */
export const fEquivalent: Generator = (rng: Rng) => {
  const { num, den } = properSimplified(rng)
  const factor = pick(rng, 2, 5)
  return problem(
    'f-equivalent',
    `${num}/${den} = ?/${den * factor}`,
    int(num * factor),
    [num, den, factor],
  )
}

/**
 * Comparing two fractions. Deliberately mixes same and different denominators —
 * the same-denominator case is a different mental move from finding a common
 * one, and a learner needs both.
 */
export const fCompare: Generator = (rng: Rng) => {
  const sameDenominator = rng() < 0.4

  const [a, b] = until(
    () => {
      const first = properSimplified(rng)
      const second = sameDenominator
        ? { num: pick(rng, 1, first.den - 1), den: first.den }
        : properSimplified(rng)
      return [first, second] as const
    },
    // An occasional equal pair is worth meeting; a stream of them is not.
    ([x, y]) => x.num * y.den !== y.num * x.den || rng() < 0.1,
  )

  const relation = a.num * b.den < b.num * a.den ? '<' : a.num * b.den > b.num * a.den ? '>' : '='

  return problem(
    'f-compare',
    `${a.num}/${a.den} ? ${b.num}/${b.den}`,
    choice(relation, ['<', '=', '>']),
    [a.num, a.den, b.num, b.den],
  )
}
