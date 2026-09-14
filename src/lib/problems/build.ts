/**
 * Helpers for constructing a Problem. Kept separate so generators stay one
 * expression each and read like the maths they produce.
 */

import type { Answer, Problem, SkillId } from '@/lib/curriculum/types'

export const int = (value: number): Answer => ({ kind: 'integer', value })

/**
 * Build a decimal answer from a SCALED INTEGER, never from float arithmetic.
 *
 * `0.1 + 0.2` is `0.30000000000000004`, so every decimal skill computes in
 * whole tenths/hundredths and converts once, here. Generators must never
 * multiply or add floats directly.
 */
export const dec = (scaled: number, dp: number): Answer => ({
  kind: 'decimal',
  value: Number((scaled / 10 ** dp).toFixed(dp)),
  dp,
})

export const choice = (value: string, options: string[]): Answer => ({
  kind: 'choice',
  value,
  options,
})

/**
 * `factKey` marks a problem as one of a finite memorizable set, which is what
 * makes it eligible for spaced repetition. Procedures pass `undefined` —
 * there is no point scheduling one specific two-step equation.
 */
export function problem(
  skill: SkillId,
  prompt: string,
  answer: Answer,
  operands: number[],
  factKey?: string,
): Problem {
  return {
    id: `${skill}#${operands.join(',')}`,
    skill,
    prompt,
    answer,
    operands,
    factKey,
  }
}
