import { test } from 'vitest'
import assert from 'node:assert/strict'
import { check } from './check'
import { formatAnswer } from './format'
import { press, canSubmit } from '@/lib/session/keypad'
import type { Answer } from '@/lib/curriculum/types'
import { generate, seeded } from './index'

const remainder = (q: number, r: number): Answer => ({ kind: 'parts', parts: [q, r], separator: 'r' })
const ratio = (a: number, b: number): Answer => ({ kind: 'parts', parts: [a, b], separator: ':' })

// ---- grading --------------------------------------------------------------

test('both parts must be right', () => {
  assert.equal(check(remainder(7, 2), '7r2'), 'correct')
  assert.equal(check(remainder(7, 2), '7r3'), 'incorrect', 'wrong remainder')
  assert.equal(check(remainder(7, 2), '8r2'), 'incorrect', 'wrong quotient')
})

test('spacing around the separator does not matter', () => {
  for (const typed of ['7r2', '7 r 2', '7 r2', '7r 2']) {
    assert.equal(check(remainder(7, 2), typed), 'correct', `"${typed}"`)
  }
})

test('a ratio uses its own separator', () => {
  assert.equal(check(ratio(2, 3), '2:3'), 'correct')
  assert.equal(check(ratio(2, 3), '2 : 3'), 'correct')
  assert.equal(check(ratio(2, 3), '3:2'), 'incorrect', 'order matters in a ratio')
})

/** A ratio in the wrong form is the same situation as an unsimplified fraction. */
test('an unsimplified ratio is right-but-unfinished', () => {
  assert.equal(check(ratio(2, 3), '4:6'), 'equivalent-unsimplified')
  assert.equal(check(ratio(2, 3), '10:15'), 'equivalent-unsimplified')
})

test('a remainder is never treated as a ratio to simplify', () => {
  // 14 r 4 and 7 r 2 are not the same answer, even though 14:4 reduces to 7:2.
  assert.equal(check(remainder(7, 2), '14r4'), 'incorrect')
})

test('half-typed and nonsense answers are incorrect, never a crash', () => {
  for (const bad of ['', '7', '7r', 'r2', 'r', 'abc', '7r2r3', '7:2']) {
    assert.equal(check(remainder(7, 2), bad), 'incorrect', `"${bad}"`)
  }
})

// ---- formatting -----------------------------------------------------------

test('parts are written with their separator spaced out', () => {
  assert.equal(formatAnswer(remainder(7, 2)), '7 r 2')
  assert.equal(formatAnswer(ratio(2, 3)), '2 : 3')
})

// ---- input ----------------------------------------------------------------

test('the separator key needs a number before it, and comes only once', () => {
  assert.equal(press('7', 'r'), '7r')
  assert.equal(press('', 'r'), '', 'nothing to separate yet')
  assert.equal(press('7r', 'r'), '7r')
  assert.equal(press('7r2', 'r'), '7r2')
  assert.equal(press('2', ':'), '2:')
  assert.equal(press('', ':'), '')
})

test('a separator does not mix with a slash or a decimal point', () => {
  assert.equal(press('3/4', 'r'), '3/4')
  assert.equal(press('3.5', ':'), '3.5')
  assert.equal(press('7r2', '/'), '7r2')
})

test('backspace walks back out of the second part', () => {
  assert.equal(press('7r2', 'back'), '7r')
  assert.equal(press('7r', 'back'), '7')
})

test('a half-typed multi-part answer cannot be submitted', () => {
  assert.equal(canSubmit('7r'), false)
  assert.equal(canSubmit('7r2'), true)
  assert.equal(canSubmit('2:'), false)
  assert.equal(canSubmit('2:3'), true)
})

// ---- m-div-remainder ------------------------------------------------------

test('division with remainders is built backwards and always balances', () => {
  const rng = seeded(808)
  for (let i = 0; i < 800; i++) {
    const p = generate('m-div-remainder', rng)
    const [, dividend, divisor] = p.prompt.match(/^(\d+) ÷ (\d+)$/)!.map(Number)
    assert.ok(p.answer.kind === 'parts')
    if (p.answer.kind !== 'parts') continue
    const [quotient, rem] = p.answer.parts
    assert.equal(dividend, divisor * quotient + rem, p.prompt)
    assert.ok(rem > 0, `${p.prompt} has no remainder — that is a different skill`)
    assert.ok(rem < divisor, `${p.prompt} remainder ${rem} is not less than ${divisor}`)
    assert.ok(quotient > 0)
  }
})

test('a remainder question is answered with both parts', () => {
  const rng = seeded(11)
  for (let i = 0; i < 200; i++) {
    const p = generate('m-div-remainder', rng)
    assert.ok(p.answer.kind === 'parts')
    if (p.answer.kind !== 'parts') continue
    assert.equal(p.answer.separator, 'r')
    assert.equal(check(p.answer, p.answer.parts.join('r')), 'correct')
    // The quotient alone is not the answer.
    assert.equal(check(p.answer, String(p.answer.parts[0])), 'incorrect')
  }
})

test('remainder questions have enough distinct problems', () => {
  const rng = seeded(3)
  const distinct = new Set(Array.from({ length: 2000 }, () => generate('m-div-remainder', rng).prompt))
  assert.ok(distinct.size >= 25, `only ${distinct.size} distinct problems`)
})
