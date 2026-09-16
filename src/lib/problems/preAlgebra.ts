import type { Difficulty, Generator, Rng } from '@/lib/curriculum/types'
import { pick } from './rng'
import { band, pickBand, pickFromBand } from './difficulty'
import { linear } from './expression'
import { dec, int, numeral, problem } from './build'

/**
 * Every equation here is built BACKWARDS: pick the solution first, then
 * construct coefficients around it. No solver, no rejection sampling, and the
 * answer is always a clean integer — never `x = 3.714285…`.
 *
 * The consequence is that solving two-step equations costs the same to build
 * as two-digit addition. Pre-algebra is not the expensive part of this
 * curriculum; fractions are. See docs/design.md.
 *
 * Difficulty here is about SIGNS, not size. `3x + 7 = 22` and `3x + 9 = 27` are
 * the same question; `−3x + 7 = 22` is a different one, and it is where the
 * mistakes live. So simple keeps everything positive and difficult reaches
 * deliberately for the negative coefficient.
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


export const pEvaluate: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const a = pickBand(rng, level, [2, 5], [2, 9], [6, 12])
  const b = pickBand(rng, level, [1, 9], [1, 20], [11, 30])
  const x = pickBand(rng, level, [2, 5], [2, 12], [7, 15])
  return problem('p-evaluate', `${term(a)} + ${b}   when x = ${x}`, int(a * x + b), [a, b, x])
}

export const pSolveOneStep: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const x = pickBand(rng, level, [1, 9], [1, 20], [12, 40])
  const b = pickBand(rng, level, [1, 9], [1, 30], [15, 50])
  return rng() < 0.5
    ? problem('p-solve-one-step', `x + ${b} = ${numeral(x + b)}`, int(x), [b, x])
    : problem('p-solve-one-step', `x − ${b} = ${numeral(x - b)}`, int(x), [b, x])
}

/**
 * Simple stays entirely positive. Difficult reaches for a negative coefficient,
 * which is the version that goes wrong — `−3x + 7 = 22` asks a child to divide
 * by a negative, and dividing by a negative is where two-step equations stop
 * being mechanical.
 */
export const pSolveTwoStep: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const x = pickBand(rng, level, [1, 8], [1, 12], [2, 15])
  const magnitude = pickBand(rng, level, [2, 5], [2, 9], [3, 9])
  const a = rng() < band(level, 0, 0, 0.6) ? -magnitude : magnitude
  const b = pickBand(rng, level, [1, 12], [-10, 20], [-25, -1])
  return problem('p-solve-two-step', `${term(a)} ${signed(b)} = ${numeral(a * x + b)}`, int(x), [a, b, x])
}

/** Coefficients kept apart (a1 > a2) so the equation has a unique solution. */
export const pSolveBothSides: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const x = pickBand(rng, level, [1, 6], [1, 12], [5, 15])
  const a2 = pickBand(rng, level, [1, 2], [1, 3], [2, 5])
  const a1 = pick(rng, a2 + 1, band(level, 5, 9, 12))
  const b1 = pickBand(rng, level, [1, 8], [1, 15], [9, 30])
  const b2 = (a1 - a2) * x + b1
  return problem(
    'p-solve-both-sides',
    `${term(a1)} + ${b1} = ${term(a2)} + ${b2}`,
    int(x),
    [a1, b1, a2, b2],
  )
}

/** Perimeter and area of a rectangle — a formula with a decimal side length. */
/** Simple uses whole centimetres, so the decimal is not a second obstacle. */
export const pFormula: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  // Lazy, so each level draws once rather than three times.
  const wScaled = band(level, () => pick(rng, 2, 9) * 10, () => pick(rng, 15, 95), () => pick(rng, 55, 95))()
  const h = pickBand(rng, level, [2, 5], [2, 9], [6, 12])
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
export const pLikeTerms: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const a = pickBand(rng, level, [2, 5], [2, 9], [6, 12])
  const b = pickBand(rng, level, [1, 4], [1, 9], [1, 5])
  const c = pickBand(rng, level, [1, 6], [1, 12], [7, 20])
  const d = pickBand(rng, level, [1, 6], [1, 12], [7, 20])
  // A subtracted x term is the part that catches people out, so simple never
  // poses one and difficult nearly always does.
  const subtractX = rng() < band(level, 0, 0.35, 0.8) && a > b

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
export const pDistribute: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  // Simple never goes negative on either side: the skill at that level is
  // "multiply both terms", not "and mind the signs".
  const outside = pickFromBand(rng, level, [2, 3, 4], [2, 3, 4, 5, 6, -2, -3, -4], [-2, -3, -4, -5, 6])
  const inner = pickBand(rng, level, [1, 5], [1, 9], [4, 12])
  const constant = pickBand(rng, level, [1, 6], [1, 12], [7, 20])
    * (rng() < band(level, 0, 0.3, 0.7) ? -1 : 1)

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

export const pInequalities: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const boundary = pickBand(rng, level, [1, 9], [-6, 9], [-12, -1])
  const magnitude = pickBand(rng, level, [2, 5], [2, 9], [3, 9])
  // The flip only happens when the coefficient is negative, so simple — which
  // never has one — never meets it, and difficult meets it most of the time.
  const negative = rng() < band(level, 0, 0.45, 0.8)
  const a = negative ? -magnitude : magnitude
  const b = pickBand(rng, level, [1, 12], [-10, 20], [-25, -1])
  const relation = pickFromBand(rng, level, ['<', '>'] as const, RELATIONS, RELATIONS)

  // With c = a*boundary + b, the inequality is true exactly at the boundary.
  const c = a * boundary + b
  const answer = `x${negative ? flip(relation) : relation}${boundary}`

  const relationSymbol = relation === '<=' ? '≤' : relation === '>=' ? '≥' : relation

  return problem(
    'p-inequalities',
    `Solve ${term(a)} ${signed(b)} ${relationSymbol} ${numeral(c)}`,
    { kind: 'expression', canonical: answer },
    [a, b, boundary],
  )
}
