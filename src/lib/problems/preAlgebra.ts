import type { Generator, Rng } from '@/lib/curriculum/types'
import { pick } from './rng'
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
const term = (coefficient: number): string => (coefficient === 1 ? 'x' : `${coefficient}x`)

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
