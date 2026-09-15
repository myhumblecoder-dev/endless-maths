import type { Generator, Rng } from '@/lib/curriculum/types'
import { pick, pickFrom } from './rng'
import { linear } from './expression'
import { dec, int, problem } from './build'

/**
 * Every equation here is built BACKWARDS: pick the solution first, then
 * construct coefficients around it. No solver, no rejection sampling, and the
 * answer is always a clean integer — never `x = 3.714285…`.
 *
 * The consequence is that solving two-step equations costs the same to build
 * as two-digit addition. Pre-algebra is not the expensive part of this
 * curriculum; fractions are. See docs/design.md.
 */

/** Renders a coefficient the way a human writes it: `x`, not `1x`. */
const term = (coefficient: number): string => {
  if (coefficient === 1) return 'x'
  if (coefficient === -1) return '−x'
  // A typographic minus throughout, matching how the answers are written.
  return coefficient < 0 ? `−${Math.abs(coefficient)}x` : `${coefficient}x`
}

/** Renders `+ 4` / `− 4` rather than `+ -4`. */
const signed = (n: number): string => `${n < 0 ? '−' : '+'} ${Math.abs(n)}`

export const pEvaluate: Generator = (rng: Rng) => {
  const a = pick(rng, 2, 9)
  const b = pick(rng, 1, 20)
  const x = pick(rng, 2, 12)
  return problem('p-evaluate', `${term(a)} + ${b}   when x = ${x}`, int(a * x + b), [a, b, x])
}

export const pSolveOneStep: Generator = (rng: Rng) => {
  const x = pick(rng, 1, 20)
  const b = pick(rng, 1, 30)
  return rng() < 0.5
    ? problem('p-solve-one-step', `x + ${b} = ${x + b}`, int(x), [b, x])
    : problem('p-solve-one-step', `x − ${b} = ${x - b}`, int(x), [b, x])
}

export const pSolveTwoStep: Generator = (rng: Rng) => {
  const x = pick(rng, 1, 12)
  const a = pick(rng, 2, 9)
  const b = pick(rng, -10, 20)
  return problem('p-solve-two-step', `${term(a)} ${signed(b)} = ${a * x + b}`, int(x), [a, b, x])
}

/** Coefficients kept apart (a1 > a2) so the equation has a unique solution. */
export const pSolveBothSides: Generator = (rng: Rng) => {
  const x = pick(rng, 1, 12)
  const a2 = pick(rng, 1, 3)
  const a1 = pick(rng, a2 + 1, 9)
  const b1 = pick(rng, 1, 15)
  const b2 = (a1 - a2) * x + b1
  return problem(
    'p-solve-both-sides',
    `${term(a1)} + ${b1} = ${term(a2)} + ${b2}`,
    int(x),
    [a1, b1, a2, b2],
  )
}

/** Perimeter and area of a rectangle — a formula with a decimal side length. */
export const pFormula: Generator = (rng: Rng) => {
  const wScaled = pick(rng, 15, 95) // 1.5 to 9.5
  const h = pick(rng, 2, 9)
  return rng() < 0.5
    ? problem('p-formula', `Area of a rectangle ${(wScaled / 10).toFixed(1)}cm by ${h}cm`, dec(wScaled * h, 1), [wScaled, h])
    : problem('p-formula', `Perimeter of a rectangle ${(wScaled / 10).toFixed(1)}cm by ${h}cm`, dec(2 * (wScaled + h * 10), 1), [wScaled, h])
}

/**
 * Collecting like terms.
 *
 * The question is itself a linear expression, so the test that the answer is
 * equivalent is just "normalise the prompt and the answer and compare" — no
 * separate solver to go wrong. Always poses something that genuinely needs
 * collecting.
 */
export const pLikeTerms: Generator = (rng: Rng) => {
  const a = pick(rng, 2, 9)
  const b = pick(rng, 1, 9)
  const c = pick(rng, 1, 12)
  const d = pick(rng, 1, 12)
  const subtractX = rng() < 0.35 && a > b

  const xTotal = subtractX ? a - b : a + b
  const constant = c + d

  return problem(
    'p-like-terms',
    subtractX
      ? `${term(a)} + ${c} − ${term(b)} + ${d}`
      : `${term(a)} + ${c} + ${term(b)} + ${d}`,
    { kind: 'expression', canonical: linear(xTotal, constant) },
    [a, b, c, d],
  )
}

/**
 * Expanding brackets. A negative multiplier is included deliberately — dropping
 * the sign on the second term is the classic slip at this level, and a run of
 * positive multipliers would never meet it.
 */
export const pDistribute: Generator = (rng: Rng) => {
  const outside = pickFrom(rng, [2, 3, 4, 5, 6, -2, -3, -4])
  const inner = pick(rng, 1, 9)
  const constant = pick(rng, 1, 12) * (rng() < 0.3 ? -1 : 1)

  const sign = constant < 0 ? '−' : '+'

  return problem(
    'p-distribute',
    // A real minus sign, matching how the answer is written.
    `${outside < 0 ? `−${Math.abs(outside)}` : outside}(${term(inner)} ${sign} ${Math.abs(constant)})`,
    { kind: 'expression', canonical: linear(outside * inner, outside * constant) },
    [outside, inner, constant],
  )
}

/**
 * Solving a linear inequality.
 *
 * Built backwards like the equations: pick the boundary the answer lands on,
 * then construct the inequality around it.
 *
 * A negative coefficient is included deliberately and often. Dividing by a
 * negative flips the relation, and that is the classic misconception at this
 * level — a run of positive coefficients would never meet it. The flip is
 * applied here exactly once, when the coefficient is negative.
 */
const RELATIONS = ['<', '>', '<=', '>='] as const

const flip = (relation: string): string =>
  relation.startsWith('<') ? relation.replace('<', '>') : relation.replace('>', '<')

export const pInequalities: Generator = (rng: Rng) => {
  const boundary = pick(rng, -6, 9)
  const magnitude = pick(rng, 2, 9)
  const negative = rng() < 0.45
  const a = negative ? -magnitude : magnitude
  const b = pick(rng, -10, 20)
  const relation = pickFrom(rng, RELATIONS)

  // With c = a*boundary + b, the inequality is true exactly at the boundary.
  const c = a * boundary + b
  const answer = `x${negative ? flip(relation) : relation}${boundary}`

  const relationSymbol = relation === '<=' ? '≤' : relation === '>=' ? '≥' : relation
  const rhs = c < 0 ? `−${Math.abs(c)}` : `${c}`

  return problem(
    'p-inequalities',
    `Solve ${term(a)} ${signed(b)} ${relationSymbol} ${rhs}`,
    { kind: 'expression', canonical: answer },
    [a, b, boundary],
  )
}
