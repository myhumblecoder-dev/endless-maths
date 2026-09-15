import { test } from 'vitest'
import assert from 'node:assert/strict'
import { canSubmit, isEntryKey, press, type Entry } from './keypad'

const blank: Entry = ''

test('digits build up the entry', () => {
  let e = blank
  for (const d of ['5', '6']) e = press(e, d)
  assert.equal(e, '56')
})

test('backspace removes the last character', () => {
  assert.equal(press('56', 'back'), '5')
  assert.equal(press('5', 'back'), '')
  assert.equal(press('', 'back'), '', 'backspace on empty is harmless')
})

test('clear empties the entry', () => {
  assert.equal(press('123', 'clear'), '')
})

test('minus is a sign at the front and an operator after a term', () => {
  assert.equal(press('', '-'), '-', 'leading sign')
  assert.equal(press('-', '-'), '-', 'no double minus')
  // Superseded by expression input: "5-" is the start of "5-3". It is
  // meaningless for a plain-number answer, but canSubmit refuses it there, so
  // nothing can be submitted half-written.
  assert.equal(press('5', '-'), '5-')
  assert.equal(canSubmit('5-'), false)
})

test('a decimal point is allowed once', () => {
  assert.equal(press('3', '.'), '3.')
  assert.equal(press('3.1', '.'), '3.1', 'no second decimal point')
})

test('a leading decimal point gets its zero', () => {
  assert.equal(press('', '.'), '0.', 'children write .5 — show them 0.5')
})

test('the entry is capped so a child cannot fill the screen', () => {
  const long = '1234567890'
  assert.equal(press(long, '1'), long, 'ten characters is already generous')
})

test('canSubmit rejects entries that are not yet a number', () => {
  assert.equal(canSubmit(''), false)
  assert.equal(canSubmit('-'), false)
  assert.equal(canSubmit('3.'), false)
  assert.equal(canSubmit('0'), true)
  assert.equal(canSubmit('-4'), true)
  assert.equal(canSubmit('3.5'), true)
})

test('choice answers submit as themselves', () => {
  assert.equal(canSubmit('yes'), true)
  assert.equal(canSubmit('<'), true)
})

// ---- typing ahead ---------------------------------------------------------

test('digits, minus, decimal point and slash are entry keys', () => {
  for (const k of ['0', '5', '9', '-', '.', '/']) {
    assert.equal(isEntryKey(k), true, `${k} should be an entry key`)
  }
})

test('control and navigation keys are not entry keys', () => {
  for (const k of ['Enter', 'Backspace', 'Shift', 'Tab', 'ArrowLeft', 'a', 'F5'])
    assert.equal(isEntryKey(k), false, `${k} should not be an entry key`)
})

// ---- fractions ------------------------------------------------------------
// A fraction is entered as one string, "3/4", so everything downstream —
// parseFraction, check, the soak tests — works unchanged.

test('the divide key starts a denominator', () => {
  assert.equal(press('3', '/'), '3/')
  assert.equal(press('12', '/'), '12/')
})

test('a fraction cannot start with a slash', () => {
  assert.equal(press('', '/'), '', 'there is nothing to divide yet')
  assert.equal(press('-', '/'), '-')
})

test('there is only one slash', () => {
  assert.equal(press('3/', '/'), '3/')
  assert.equal(press('3/4', '/'), '3/4')
})

test('a denominator takes digits', () => {
  assert.equal(press('3/', '4'), '3/4')
  assert.equal(press('3/1', '2'), '3/12')
})

test('backspace walks back out of the denominator', () => {
  assert.equal(press('3/4', 'back'), '3/')
  assert.equal(press('3/', 'back'), '3')
})

test('a minus never appears inside a fraction', () => {
  assert.equal(press('3/4', '-'), '3/4', 'no minus in a denominator')
})

test('a half-typed fraction cannot be submitted', () => {
  assert.equal(canSubmit('3/'), false, 'no denominator yet')
  assert.equal(canSubmit('/4'), false)
  assert.equal(canSubmit('3/4'), true)
  assert.equal(canSubmit('-3/4'), true)
  assert.equal(canSubmit('3/0'), true, 'gradeable, and check() marks it incorrect')
})

test('a decimal point and a slash do not mix', () => {
  assert.equal(press('3.5', '/'), '3.5', 'a fraction of a decimal is not a thing here')
  assert.equal(press('3/4', '.'), '3/4')
})

// ---- expressions ----------------------------------------------------------

test('an expression can actually be typed', () => {
  let e = ''
  for (const k of ['7', 'x', '+', '5']) e = press(e, k)
  assert.equal(e, '7x+5')
  assert.equal(canSubmit('7x+5'), true)
})

test('x follows a number or stands alone', () => {
  assert.equal(press('', 'x'), 'x')
  assert.equal(press('7', 'x'), '7x')
  assert.equal(press('7x', 'x'), '7x', 'one x per term')
  assert.equal(press('7x+', 'x'), '7x+x')
})

test('plus needs something to add to', () => {
  assert.equal(press('', '+'), '')
  assert.equal(press('7x', '+'), '7x+')
  assert.equal(press('7x+', '+'), '7x+', 'no double operator')
})

test('minus works as both a sign and an operator', () => {
  assert.equal(press('', '-'), '-', 'leading sign')
  assert.equal(press('7x', '-'), '7x-', 'binary minus')
  assert.equal(press('7x-', '-'), '7x-', 'no double operator')
})

test('a half-written expression cannot be submitted', () => {
  assert.equal(canSubmit('7x+'), false)
  assert.equal(canSubmit('7x-'), false)
  assert.equal(canSubmit('x'), true)
  assert.equal(canSubmit('-x'), true)
})

test('x and the operators are entry keys', () => {
  for (const k of ['x', '+']) assert.equal(isEntryKey(k), true, `${k} should be an entry key`)
})
