import type { Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom, until } from './rng'
import { choice, dec, int, problem } from './build'
import { gcd, simplify } from './fraction'

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

/**
 * Adding and subtracting with a shared denominator.
 *
 * The expected answer is the SIMPLIFIED result, which makes these the first
 * skills where the simplify-everything policy really bites: 1/6 + 2/6 is 3/6,
 * and a learner who stops there has done the arithmetic but not the skill. They
 * get "Right — now simplify it" and another go. That is the intent, not a
 * side effect — see docs/design.md.
 *
 * Denominators start at 3, since halves leave no room for a proper result.
 */
const LIKE_DENOMINATORS = DENOMINATORS.filter((d) => d >= 3)

function likeParts(rng: Rng, subtract: boolean): { a: number; b: number; den: number } {
  const den = pickFrom(rng, LIKE_DENOMINATORS)
  return subtract
    // a > b keeps the result positive; negatives are a separate skill entirely.
    ? (() => {
        const a = pick(rng, 2, den - 1)
        return { a, b: pick(rng, 1, a - 1), den }
      })()
    : (() => {
        const a = pick(rng, 1, den - 2)
        return { a, b: pick(rng, 1, den - a - 1), den }
      })()
}

export const fAddLike: Generator = (rng: Rng) => {
  const { a, b, den } = likeParts(rng, false)
  const answer = simplify(a + b, den)
  return problem(
    'f-add-like',
    `${a}/${den} + ${b}/${den}`,
    { kind: 'fraction', num: answer.num, den: answer.den },
    [a, b, den],
  )
}

export const fSubLike: Generator = (rng: Rng) => {
  const { a, b, den } = likeParts(rng, true)
  const answer = simplify(a - b, den)
  return problem(
    'f-sub-like',
    `${a}/${den} − ${b}/${den}`,
    { kind: 'fraction', num: answer.num, den: answer.den },
    [a, b, den],
  )
}

/**
 * Adding fractions with different denominators — the hardest of the set, and
 * where the classic misconception lives: 1/2 + 1/3 = 2/5, adding straight
 * across. That answer is genuinely wrong rather than merely unsimplified, and
 * `check` treats it that way.
 *
 * Pairs are constrained to a common denominator of 24 or less so the
 * arithmetic stays mental, and the sum is kept proper.
 */
const UNLIKE_LCM_LIMIT = 24

export const fAddUnlike: Generator = (rng: Rng) => {
  const { a, d1, b, d2 } = until(
    () => {
      const first = properSimplified(rng)
      const second = properSimplified(rng)
      return { a: first.num, d1: first.den, b: second.num, d2: second.den }
    },
    ({ a, d1, b, d2 }) =>
      d1 !== d2 &&
      (d1 * d2) / gcd(d1, d2) <= UNLIKE_LCM_LIMIT &&
      // Keep the result proper: a/d1 + b/d2 <= 1.
      a * d2 + b * d1 <= d1 * d2,
  )

  const answer = simplify(a * d2 + b * d1, d1 * d2)
  return problem(
    'f-add-unlike',
    `${a}/${d1} + ${b}/${d2}`,
    { kind: 'fraction', num: answer.num, den: answer.den },
    [a, d1, b, d2],
  )
}

/**
 * Multiplying and dividing fractions.
 *
 * Both pose their operands in lowest terms, as a textbook would, and both give
 * a simplified answer. Division may land on a whole number or an improper
 * fraction — that is honest to the maths, and `formatAnswer` writes a
 * denominator of 1 as a plain whole number.
 */
export const fMultiply: Generator = (rng: Rng) => {
  const first = properSimplified(rng)
  const second = properSimplified(rng)
  const answer = simplify(first.num * second.num, first.den * second.den)
  return problem(
    'f-multiply',
    `${first.num}/${first.den} × ${second.num}/${second.den}`,
    { kind: 'fraction', num: answer.num, den: answer.den },
    [first.num, first.den, second.num, second.den],
  )
}

export const fDivide: Generator = (rng: Rng) => {
  const first = properSimplified(rng)
  const second = properSimplified(rng)
  // Dividing by b/d is multiplying by d/b.
  const answer = simplify(first.num * second.den, first.den * second.num)
  return problem(
    'f-divide',
    `${first.num}/${first.den} ÷ ${second.num}/${second.den}`,
    { kind: 'fraction', num: answer.num, den: answer.den },
    [first.num, first.den, second.num, second.den],
  )
}

/**
 * Converting between fractions, decimals and percentages, in all four
 * directions — which is why this skill declares several answer kinds.
 *
 * Denominators are restricted to those dividing 100, so every conversion
 * terminates exactly and every percentage is a whole number. A recurring
 * decimal has no exact form to type, and asking for one would be unanswerable.
 */
const CONVERTIBLE_DENOMINATORS = [2, 4, 5, 10, 20, 25, 50] as const

export const fConvertFdp: Generator = (rng: Rng) => {
  const { num, den } = until(
    () => {
      const den = pickFrom(rng, CONVERTIBLE_DENOMINATORS)
      return { num: pick(rng, 1, den - 1), den }
    },
    ({ num, den }) => gcd(num, den) === 1,
  )

  const hundredths = (num * 100) / den // exact: every denominator divides 100
  // 0.5, not 0.50 — nobody writes the trailing zero, and in a prompt it also
  // quietly hints at the shape of the answer.
  const places = hundredths % 10 === 0 ? 1 : 2
  const asDecimal = (hundredths / 100).toFixed(places)
  const direction = pickFrom(rng, ['decimal', 'percent', 'fromDecimal', 'fromPercent'] as const)
  const operands = [num, den]

  switch (direction) {
    case 'decimal':
      return problem('f-convert-fdp', `Write ${num}/${den} as a decimal`, dec(hundredths / (places === 1 ? 10 : 1), places), operands)
    case 'percent':
      return problem('f-convert-fdp', `Write ${num}/${den} as a percentage`, int(hundredths), operands)
    case 'fromDecimal':
      return problem(
        'f-convert-fdp',
        `Write ${asDecimal} as a fraction`,
        { kind: 'fraction', num, den },
        operands,
      )
    default:
      return problem(
        'f-convert-fdp',
        `Write ${hundredths}% as a fraction`,
        { kind: 'fraction', num, den },
        operands,
      )
  }
}
