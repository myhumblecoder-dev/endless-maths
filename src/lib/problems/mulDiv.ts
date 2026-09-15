import type { Generator, Rng, SkillId } from '@/lib/curriculum/types'
import { pick, pickFrom } from './rng'
import { int, problem } from './build'

/**
 * Tables are split 2/5/10 · 3/4 · 6/7/8/9 rather than kept as one blob,
 * because that is the order children actually acquire them. A uniform draw
 * over "multiplication" spends most of a session on facts already owned.
 */

const timesTable = (skill: SkillId, tables: readonly number[]): Generator => (rng: Rng) => {
  const a = pickFrom(rng, tables)
  const b = pick(rng, 2, 12)
  return problem(skill, `${a} × ${b}`, int(a * b), [a, b], `mul:${a}x${b}`)
}

/**
 * Division is generated BACKWARDS — pick the quotient and divisor, then
 * present their product. That guarantees an exact division without a solver
 * and without ever rejecting a draw.
 */
const divTable = (skill: SkillId, tables: readonly number[]): Generator => (rng: Rng) => {
  const divisor = pickFrom(rng, tables)
  const quotient = pick(rng, 2, 12)
  return problem(
    skill,
    `${divisor * quotient} ÷ ${divisor}`,
    int(quotient),
    [divisor * quotient, divisor],
    `div:${divisor * quotient}/${divisor}`,
  )
}

export const mTimes2510 = timesTable('m-times-2-5-10', [2, 5, 10])
export const mTimes34 = timesTable('m-times-3-4', [3, 4])
export const mTimes6789 = timesTable('m-times-6-7-8-9', [6, 7, 8, 9])
export const mDiv2510 = divTable('m-div-2-5-10', [2, 5, 10])
export const mDiv34 = divTable('m-div-3-4', [3, 4])
export const mDiv6789 = divTable('m-div-6-7-8-9', [6, 7, 8, 9])

export const m2DigitBy1Digit: Generator = (rng: Rng) => {
  const a = pick(rng, 12, 99)
  const b = pick(rng, 3, 9)
  return problem('m-2digit-x-1digit', `${a} × ${b}`, int(a * b), [a, b])
}

/**
 * Division that does not come out exactly.
 *
 * Built backwards, like every other division here: pick the quotient, divisor
 * and remainder, then present the dividend they imply. The remainder is always
 * at least 1 — a remainder of zero is exact division, which is a different
 * skill the learner has already met.
 */
export const mDivRemainder: Generator = (rng: Rng) => {
  const divisor = pick(rng, 3, 12)
  const quotient = pick(rng, 2, 20)
  const remainder = pick(rng, 1, divisor - 1)
  const dividend = divisor * quotient + remainder
  return problem(
    'm-div-remainder',
    `${dividend} ÷ ${divisor}`,
    { kind: 'parts', parts: [quotient, remainder], separator: 'r' },
    [dividend, divisor],
  )
}

/**
 * Long multiplication and division, asked answer-only.
 *
 * Caveat worth knowing: the lesson in these skills is the WRITTEN METHOD, and
 * asking only for the final number does not practise it. These are here
 * because they are cheap and still useful drill, but a child who can do these
 * mentally has not demonstrated the thing the curriculum is asking for. A
 * proper version needs step-by-step layout entry — deferred.
 */
export const mLongMult: Generator = (rng: Rng) => {
  const a = pick(rng, 12, 99)
  const b = pick(rng, 12, 99)
  return problem('m-long-mult', `${a} × ${b}`, int(a * b), [a, b])
}

export const mLongDiv: Generator = (rng: Rng) => {
  const divisor = pick(rng, 12, 25)
  const quotient = pick(rng, 11, 99)
  return problem('m-long-div', `${divisor * quotient} ÷ ${divisor}`, int(quotient), [divisor * quotient, divisor])
}
