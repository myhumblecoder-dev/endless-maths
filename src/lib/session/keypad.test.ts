import { test } from 'vitest'
import assert from 'node:assert/strict'
import { press, canSubmit, type Entry } from './keypad'

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

test('minus is allowed only at the front', () => {
  assert.equal(press('', '-'), '-')
  assert.equal(press('5', '-'), '5', 'a minus mid-number is meaningless')
  assert.equal(press('-', '-'), '-', 'no double minus')
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
