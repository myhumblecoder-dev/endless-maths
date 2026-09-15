import { test } from 'vitest'
import assert from 'node:assert/strict'
import { check } from './check'
import { gcd, simplify, parseFraction } from './fraction'
import type { Answer } from '@/lib/curriculum/types'

const frac = (num: number, den: number): Answer => ({ kind: 'fraction', num, den })
const mixed = (whole: number, num: number, den: number): Answer => ({ kind: 'mixed', whole, num, den })

// ---- the arithmetic -------------------------------------------------------

test('gcd handles the cases that break naive implementations', () => {
  assert.equal(gcd(6, 8), 2)
  assert.equal(gcd(8, 6), 2)
  assert.equal(gcd(7, 13), 1)
  assert.equal(gcd(0, 5), 5, 'gcd with zero is the other number')
  assert.equal(gcd(-6, 8), 2, 'sign must not leak into the divisor')
})

test('simplify reduces to lowest terms and normalises the sign', () => {
  assert.deepEqual(simplify(6, 8), { num: 3, den: 4 })
  assert.deepEqual(simplify(3, 4), { num: 3, den: 4 })
  assert.deepEqual(simplify(-6, 8), { num: -3, den: 4 })
  assert.deepEqual(simplify(6, -8), { num: -3, den: 4 }, 'the minus belongs on the numerator')
  assert.deepEqual(simplify(0, 5), { num: 0, den: 1 })
})

test('parseFraction accepts what the input can produce, and rejects the rest', () => {
  assert.deepEqual(parseFraction('3/4'), { num: 3, den: 4 })
  assert.deepEqual(parseFraction('-3/4'), { num: -3, den: 4 })
  assert.deepEqual(parseFraction('1 3/4'), { num: 7, den: 4 }, 'mixed numbers become improper')
  assert.deepEqual(parseFraction('-1 3/4'), { num: -7, den: 4 }, 'the whole part carries the sign')
  assert.deepEqual(parseFraction('5'), { num: 5, den: 1 }, 'a whole number is a fraction')
  for (const bad of ['', '/', '3/', '/4', 'abc', '3/0', '1//2', '3 / ']) {
    assert.equal(parseFraction(bad), undefined, `"${bad}" should not parse`)
  }
})

// ---- grading --------------------------------------------------------------

test('the simplified answer is correct', () => {
  assert.equal(check(frac(3, 4), '3/4'), 'correct')
})

/**
 * The policy from docs/design.md: 3/4 is the answer, and putting a fraction in
 * lowest terms is itself worth practising. So an unsimplified answer is neither
 * marked wrong nor silently accepted.
 */
test('an unsimplified answer is right-but-unfinished, never wrong', () => {
  assert.equal(check(frac(3, 4), '6/8'), 'equivalent-unsimplified')
  assert.equal(check(frac(3, 4), '75/100'), 'equivalent-unsimplified')
  assert.equal(check(frac(1, 2), '2/4'), 'equivalent-unsimplified')
})

test('a genuinely different fraction is incorrect', () => {
  assert.equal(check(frac(3, 4), '2/3'), 'incorrect')
  assert.equal(check(frac(3, 4), '4/3'), 'incorrect', 'the flipped fraction is a real mistake')
})

test('improper and mixed forms of the same number agree', () => {
  assert.equal(check(frac(7, 4), '1 3/4'), 'correct')
  assert.equal(check(mixed(1, 3, 4), '7/4'), 'correct')
  assert.equal(check(mixed(1, 3, 4), '1 3/4'), 'correct')
})

test('negative fractions compare correctly', () => {
  assert.equal(check(frac(-3, 4), '-3/4'), 'correct')
  assert.equal(check(frac(-3, 4), '-6/8'), 'equivalent-unsimplified')
  assert.equal(check(frac(-3, 4), '3/4'), 'incorrect', 'sign is not a detail')
})

test('a whole-number answer works as a fraction', () => {
  assert.equal(check(frac(2, 1), '2'), 'correct')
  assert.equal(check(frac(2, 1), '4/2'), 'equivalent-unsimplified')
})

test('nonsense and division by zero are incorrect, never a crash', () => {
  for (const bad of ['', ' ', 'abc', '3/0', '/', '3/', '0/0']) {
    assert.equal(check(frac(3, 4), bad), 'incorrect', `"${bad}" should be incorrect`)
  }
})

/**
 * Every answer kind is handled now, so the guard is unreachable in practice.
 * It stays because the cost of a missing branch is marking a correct answer
 * wrong, and failing loudly is the only acceptable way to meet that.
 */
test('check throws rather than guesses at an answer kind it does not know', () => {
  const unknown = { kind: 'something-new', value: 1 } as unknown as Answer
  assert.throws(() => check(unknown, '1'), /not implemented/)
})
