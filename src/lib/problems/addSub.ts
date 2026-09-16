import type { Difficulty, Generator, Rng, SkillId } from '@/lib/curriculum/types'
import { pick, until } from './rng'
import { band } from './difficulty'
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

/** `wanted` of -1 accepts anything, 0 demands none, and n > 0 demands at least n. */
const matches = (actual: number, wanted: number): boolean =>
  wanted < 0 || (wanted === 0 ? actual === 0 : actual >= wanted)

/** How many column sums reach ten — which is what actually makes this hard. */
const carries = (a: number, b: number): number => {
  let count = 0
  let carry = 0
  for (let place = 1; place <= 100; place *= 10) {
    const sum = (Math.floor(a / place) % 10) + (Math.floor(b / place) % 10) + carry
    carry = sum >= 10 ? 1 : 0
    count += carry
  }
  return count
}

/**
 * Three-digit addition, graded by CARRYING rather than by size.
 *
 * Bigger numbers are not harder ones: 800 + 100 is easier than 476 + 385
 * despite the larger operands. Simple carries nowhere, difficult carries in
 * every column — which is the version that actually catches people out.
 */
export const aAdd3Digit: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const wanted = band(level, 0, -1, 2) // -1 means "however it falls"
  const [a, b] = until(
    () => {
      const x = pick(rng, 100, 899)
      return [x, pick(rng, 100, Math.max(100, 999 - x))] as [number, number]
    },
    ([x, y]) => x + y <= 999 && matches(carries(x, y), wanted),
  )
  return problem('a-add-3digit', `${a} + ${b}`, int(a + b), [a, b])
}

/** How many columns have to borrow. The mirror of `carries`. */
const borrows = (a: number, b: number): number => {
  let count = 0
  let borrow = 0
  for (let place = 1; place <= 100; place *= 10) {
    const top = (Math.floor(a / place) % 10) - borrow
    const bottom = Math.floor(b / place) % 10
    borrow = top < bottom ? 1 : 0
    count += borrow
  }
  return count
}

/**
 * Result stays positive — negative answers are a separate skill entirely.
 * Graded by borrowing, for the same reason addition is graded by carrying.
 */
export const aSub3Digit: Generator = (rng: Rng, level: Difficulty = 'medium') => {
  const wanted = band(level, 0, -1, 2)
  const [a, b] = until(
    () => {
      const x = pick(rng, 200, 999)
      return [x, pick(rng, 100, x - 1)] as [number, number]
    },
    ([x, y]) => matches(borrows(x, y), wanted),
  )
  return problem('a-sub-3digit', `${a} − ${b}`, int(a - b), [a, b])
}
