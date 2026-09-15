import { test } from 'vitest'
import assert from 'node:assert/strict'
import { press, canSubmit, isEntryKey } from './keypad'
import { check } from '@/lib/problems/check'
import type { Answer } from '@/lib/curriculum/types'

const int = (value: number): Answer => ({ kind: 'integer', value })
const frac = (num: number, den: number): Answer => ({ kind: 'fraction', num, den })
const rem = (q: number, r: number): Answer => ({ kind: 'parts', parts: [q, r], separator: 'r' })
const expr = (canonical: string): Answer => ({ kind: 'expression', canonical })
const dec = (value: number, dp: number): Answer => ({ kind: 'decimal', value, dp })

/**
 * Reported by review. A child answering 7 x 8 types "56", then presses x —
 * the obvious key for "times" on a physical keyboard. The entry became "56x",
 * Check stayed enabled, and a correct answer was graded incorrect.
 *
 * This is the failure the whole codebase is built to avoid.
 */
test('the unknown is not an entry key unless an expression is wanted', () => {
  assert.equal(isEntryKey('x', int(56)), false, 'x means nothing in a numeric answer')
  assert.equal(isEntryKey('+', int(56)), false)
  assert.equal(isEntryKey('x', expr('5x')), true)

  let entry = ''
  for (const k of ['5', '6']) entry = press(entry, k, int(56))
  entry = press(entry, 'x', int(56))
  assert.equal(entry, '56', 'a stray x must not corrupt the entry')
  assert.equal(canSubmit(entry, int(56)), true)
  assert.equal(check(int(56), entry), 'correct')
})

test('keys belonging to other answer kinds are refused', () => {
  assert.equal(press('3/4', 'x', frac(3, 4)), '3/4', 'no unknown inside a fraction')
  assert.equal(press('3/4', '+', frac(3, 4)), '3/4')
  assert.equal(press('7r2', 'x', rem(7, 2)), '7r2')
  assert.equal(press('5', '/', int(5)), '5', 'no fraction bar in a whole-number answer')
  assert.equal(press('5', 'r', int(5)), '5')
  assert.equal(press('5', ':', int(5)), '5')
  assert.equal(press('5', '.', int(5)), '5', 'no decimal point where a whole number is wanted')
})

/** Reported by review: the minus became an operator for every answer kind. */
test('a minus after a digit is an operator only in an expression', () => {
  assert.equal(press('5', '-', int(-5)), '5', 'tapping minus after 5 should not strand the entry')
  assert.equal(canSubmit('5', int(5)), true)
  assert.equal(press('5', '-', expr('5x-3')), '5-', 'but it is an operator in an expression')
})

/** Reported by review: x and + bypassed the length cap every other key has. */
test('every key respects the length cap', () => {
  const long = 'x+x+x+x+x'
  assert.equal(press(`${long}+`, 'x', expr('x')).length <= 10, true)
  assert.equal(press('1234567890', 'x', expr('x')), '1234567890')
})

test('the other answer kinds still accept their own keys', () => {
  assert.equal(press('3', '/', frac(3, 4)), '3/')
  assert.equal(press('7', 'r', rem(7, 2)), '7r')
  assert.equal(press('3', '.', dec(3.5, 1)), '3.')
  assert.equal(press('', '-', int(-5)), '-')
})

/**
 * Reported by review: a malformed canonical made every answer compare false,
 * silently marking correct answers wrong — the opposite of check()'s policy.
 */
test('an unparseable expected expression fails loudly', () => {
  assert.throws(() => check(expr('5x+-3'), '5x-3'), /canonical/i)
})
