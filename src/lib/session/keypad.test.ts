import { test } from 'vitest'
import assert from 'node:assert/strict'
import { canSubmit, isEntryKey, press, type Entry } from './keypad'
import type { Answer } from '@/lib/curriculum/types'

// The rules depend on what kind of answer is expected, so every assertion names
// one. A bare `press` with no context is exactly what let "56x" through.
const int: Answer = { kind: 'integer', value: 0 }
const dec: Answer = { kind: 'decimal', value: 0, dp: 2 }
const frac: Answer = { kind: 'fraction', num: 1, den: 2 }
const rem: Answer = { kind: 'parts', parts: [1, 1], separator: 'r' }
const expr: Answer = { kind: 'expression', canonical: 'x' }

const blank: Entry = ''

test('digits build up the entry', () => {
  let e = blank
  for (const d of ['5', '6']) e = press(e, d, int)
  assert.equal(e, '56')
})

test('backspace removes the last character', () => {
  assert.equal(press('56', 'back', int), '5')
  assert.equal(press('5', 'back', int), '')
  assert.equal(press('', 'back', int), '', 'backspace on empty is harmless')
})

test('clear empties the entry', () => {
  assert.equal(press('123', 'clear', int), '')
})

test('minus is a sign at the front, and an operator only in an expression', () => {
  assert.equal(press('', '-', int), '-', 'leading sign')
  assert.equal(press('-', '-', int), '-', 'no double minus')
  // In a plain number there is nothing to subtract from, so the press is
  // ignored rather than stranding the entry in a state that cannot be sent.
  assert.equal(press('5', '-', int), '5')
  assert.equal(press('5', '-', expr), '5-', 'but an expression can subtract')
})

test('a decimal point is allowed once', () => {
  assert.equal(press('3', '.', dec), '3.')
  assert.equal(press('3.1', '.', dec), '3.1', 'no second decimal point')
})

test('a leading decimal point gets its zero', () => {
  assert.equal(press('', '.', dec), '0.', 'children write .5 — show them 0.5')
})

test('the entry is capped so a child cannot fill the screen', () => {
  const long = '1234567890'
  assert.equal(press(long, '1', int), long, 'ten characters is already generous')
})

test('canSubmit rejects entries that are not yet a number', () => {
  assert.equal(canSubmit('', int), false)
  assert.equal(canSubmit('-', int), false)
  assert.equal(canSubmit('3.', dec), false)
  assert.equal(canSubmit('0', int), true)
  assert.equal(canSubmit('-4', int), true)
  assert.equal(canSubmit('3.5', dec), true)
})

test('choice answers submit as themselves', () => {
  const yesNo: Answer = { kind: 'choice', value: 'yes', options: ['yes', 'no'] }
  const compare: Answer = { kind: 'choice', value: '<', options: ['<', '=', '>'] }
  assert.equal(canSubmit('yes', yesNo), true)
  assert.equal(canSubmit('<', compare), true)
})

// ---- typing ahead ---------------------------------------------------------

test('a key is an entry key only for the answer kinds it belongs to', () => {
  for (const k of ['0', '5', '9']) {
    assert.equal(isEntryKey(k, int), true, `${k} is a digit`)
  }
  assert.equal(isEntryKey('-', int), true)
  assert.equal(isEntryKey('.', dec), true)
  assert.equal(isEntryKey('/', frac), true)
  assert.equal(isEntryKey('r', rem), true)
  assert.equal(isEntryKey('x', expr), true)

  // And nowhere else — this is the guard that stops "56x" on a times table.
  assert.equal(isEntryKey('.', int), false)
  assert.equal(isEntryKey('/', int), false)
  assert.equal(isEntryKey('r', int), false)
  assert.equal(isEntryKey('x', int), false)
})

test('control and navigation keys are not entry keys', () => {
  for (const k of ['Enter', 'Backspace', 'Shift', 'Tab', 'ArrowLeft', 'a', 'F5'])
    assert.equal(isEntryKey(k, expr), false, `${k} should not be an entry key`)
})

// ---- fractions ------------------------------------------------------------
// A fraction is entered as one string, "3/4", so everything downstream —
// parseFraction, check, the soak tests — works unchanged.

test('the divide key starts a denominator', () => {
  assert.equal(press('3', '/', frac), '3/')
  assert.equal(press('12', '/', frac), '12/')
})

test('a fraction cannot start with a slash', () => {
  assert.equal(press('', '/', frac), '', 'there is nothing to divide yet')
  assert.equal(press('-', '/', frac), '-')
})

test('there is only one slash', () => {
  assert.equal(press('3/', '/', frac), '3/')
  assert.equal(press('3/4', '/', frac), '3/4')
})

test('a denominator takes digits', () => {
  assert.equal(press('3/', '4', frac), '3/4')
  assert.equal(press('3/1', '2', frac), '3/12')
})

test('backspace walks back out of the denominator', () => {
  assert.equal(press('3/4', 'back', frac), '3/')
  assert.equal(press('3/', 'back', frac), '3')
})

test('a minus never appears inside a fraction', () => {
  assert.equal(press('3/4', '-', frac), '3/4', 'no minus in a denominator')
})

test('a half-typed fraction cannot be submitted', () => {
  assert.equal(canSubmit('3/', frac), false, 'no denominator yet')
  assert.equal(canSubmit('/4', frac), false)
  assert.equal(canSubmit('3/4', frac), true)
  assert.equal(canSubmit('-3/4', frac), true)
  assert.equal(canSubmit('3/0', frac), true, 'gradeable, and check() marks it incorrect')
})

test('a decimal point and a slash do not mix', () => {
  // Neither key is offered for the other kind, so these are belt and braces.
  assert.equal(press('3.5', '/', dec), '3.5', 'a fraction of a decimal is not a thing here')
  assert.equal(press('3/4', '.', frac), '3/4')
})

// ---- expressions ----------------------------------------------------------

test('an expression can actually be typed', () => {
  let e = ''
  for (const k of ['7', 'x', '+', '5']) e = press(e, k, expr)
  assert.equal(e, '7x+5')
  assert.equal(canSubmit('7x+5', expr), true)
})

test('x follows a number or stands alone', () => {
  assert.equal(press('', 'x', expr), 'x')
  assert.equal(press('7', 'x', expr), '7x')
  assert.equal(press('7x', 'x', expr), '7x', 'one x per term')
  assert.equal(press('7x+', 'x', expr), '7x+x')
})

test('plus needs something to add to', () => {
  assert.equal(press('', '+', expr), '')
  assert.equal(press('7x', '+', expr), '7x+')
  assert.equal(press('7x+', '+', expr), '7x+', 'no double operator')
})

test('minus works as both a sign and an operator', () => {
  assert.equal(press('', '-', int), '-', 'leading sign')
  assert.equal(press('7x', '-', expr), '7x-', 'binary minus')
  assert.equal(press('7x-', '-', expr), '7x-', 'no double operator')
})

test('a half-written expression cannot be submitted', () => {
  assert.equal(canSubmit('7x+', expr), false)
  assert.equal(canSubmit('7x-', expr), false)
  assert.equal(canSubmit('x', expr), true)
  assert.equal(canSubmit('-x', expr), true)
})

test('x and the operators are entry keys', () => {
  for (const k of ['x', '+']) assert.equal(isEntryKey(k, expr), true, `${k} should be an entry key`)
})
