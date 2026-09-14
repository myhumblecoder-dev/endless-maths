import type { Generator, Rng, SkillId } from '@/lib/curriculum/types'
import { pick, until } from './rng'
import { int, problem } from './build'

/**
 * Within 10 and within 20 are FACTS — a child should recall `7 + 5`, not
 * compute it — so they carry a factKey and get scheduled by spaced repetition.
 * Everything from two digits up is a PROCEDURE: there is nothing to memorize,
 * and taking time over it is correct behaviour.
 */

const addFact = (skill: SkillId, limit: number): Generator => (rng: Rng) => {
  const a = pick(rng, 1, limit - 1)
  const b = pick(rng, 1, limit - a)
  return problem(skill, `${a} + ${b}`, int(a + b), [a, b], `add:${a}+${b}`)
}

const subFact = (skill: SkillId, limit: number): Generator => (rng: Rng) => {
  const a = pick(rng, 2, limit)
  const b = pick(rng, 1, a - 1)
  return problem(skill, `${a} − ${b}`, int(a - b), [a, b], `sub:${a}-${b}`)
}

export const aAddWithin10 = addFact('a-add-within-10', 10)
export const aAddWithin20 = addFact('a-add-within-20', 20)
export const aSubWithin10 = subFact('a-sub-within-10', 10)
export const aSubWithin20 = subFact('a-sub-within-20', 20)

/**
 * Two-digit addition, split by whether it carries. The split is the whole
 * point: carrying is a distinct skill children fail independently, so mixing
 * both into one "two-digit addition" bucket hides exactly the gap we want.
 */
const addTwoDigit = (skill: SkillId, mustCarry: boolean): Generator => (rng: Rng) => {
  const [a, b] = until(
    () => [pick(rng, 10, 89), pick(rng, 10, 89)] as [number, number],
    ([x, y]) => ((x % 10) + (y % 10) >= 10) === mustCarry && x + y < 100,
  )
  return problem(skill, `${a} + ${b}`, int(a + b), [a, b])
}

/** Likewise for subtraction: borrowing is its own skill. */
const subTwoDigit = (skill: SkillId, mustBorrow: boolean): Generator => (rng: Rng) => {
  const [a, b] = until(
    () => [pick(rng, 21, 99), pick(rng, 10, 89)] as [number, number],
    ([x, y]) => x > y && (x % 10 < y % 10) === mustBorrow,
  )
  return problem(skill, `${a} − ${b}`, int(a - b), [a, b])
}

export const aAdd2Digit = addTwoDigit('a-add-2digit', false)
export const aAdd2DigitRegroup = addTwoDigit('a-add-2digit-regroup', true)
export const aSub2Digit = subTwoDigit('a-sub-2digit', false)
export const aSub2DigitRegroup = subTwoDigit('a-sub-2digit-regroup', true)

export const aAdd3Digit: Generator = (rng: Rng) => {
  const a = pick(rng, 100, 899)
  const b = pick(rng, 100, 999 - a > 100 ? 999 - a : 100)
  return problem('a-add-3digit', `${a} + ${b}`, int(a + b), [a, b])
}

/** Result stays positive — negative answers are a separate skill entirely. */
export const aSub3Digit: Generator = (rng: Rng) => {
  const a = pick(rng, 200, 999)
  const b = pick(rng, 100, a - 1)
  return problem('a-sub-3digit', `${a} − ${b}`, int(a - b), [a, b])
}
