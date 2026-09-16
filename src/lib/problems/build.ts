/**
 * Helpers for constructing a Problem. Kept separate so generators stay one
 * expression each and read like the maths they produce.
 */

import type { Answer, Problem, SkillId } from '@/lib/curriculum/types'

export const int = (value: number): Answer => ({ kind: 'integer', value })

/**
 * A number as it appears in a PROMPT, with a typographic minus.
 *
 * `formatAnswer` already writes answers this way. Prompts were interpolating
 * negatives with a bare `${n}`, so `−3x − 10 = -28` put a hyphen and a minus
 * on the same line — the same idea in two different characters, in a subject
 * where the character IS the meaning.
 */
export const numeral = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : `${n}`)

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
