// @vitest-environment jsdom
import { test, afterEach, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Keypad } from './Keypad'
import type { Answer } from '@/lib/curriculum/types'

afterEach(cleanup)

const show = (answer: Answer, onKey = vi.fn()) => {
  render(<Keypad answer={answer} onKey={onKey} onSubmit={() => {}} canSubmit={false} disabled={false} />)
  return onKey
}

const keyNames = () =>
  [...document.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '')

/**
 * The keypad must offer exactly the keys an answer of this kind needs. Offering
 * more is not harmless: an `x` during a times table produced "56x", which was
 * submittable and graded a correct answer wrong.
 */
test('a whole-number answer gets digits and a minus, nothing else', () => {
  show({ kind: 'integer', value: 5 })
  const keys = keyNames()
  assert.ok(keys.includes('−'), 'minus for negative answers')
  for (const absent of ['x', '+', '/', 'r', ':', '<', '>', '.']) {
    assert.ok(!keys.includes(absent), `${absent} does not belong on a whole-number keypad`)
  }
})

test('a fraction answer gets a divide key and no operators', () => {
  const keys = (show({ kind: 'fraction', num: 3, den: 4 }), keyNames())
  assert.ok(keys.includes('/'))
  for (const absent of ['x', '+', '−', '<', '>']) {
    assert.ok(!keys.includes(absent), `${absent} does not belong on a fraction keypad`)
  }
})

test('a remainder answer gets its own separator', () => {
  const keys = (show({ kind: 'parts', parts: [7, 2], separator: 'r' }), keyNames())
  assert.ok(keys.includes('r'))
  assert.ok(!keys.includes(':'), 'a ratio separator would grade as a different answer')
})

test('a ratio answer gets the colon', () => {
  const keys = (show({ kind: 'parts', parts: [2, 3], separator: ':' }), keyNames())
  assert.ok(keys.includes(':'))
  assert.ok(!keys.includes('r'))
})

test('an expression answer gets the unknown and the operators', () => {
  const keys = (show({ kind: 'expression', canonical: '5x+3' }), keyNames())
  for (const present of ['x', '+', '−']) assert.ok(keys.includes(present), `${present} is missing`)
  // No relations: a stray one would make the entry unparseable and silently
  // disable Submit, with nothing on screen to explain why.
  for (const absent of ['<', '>']) assert.ok(!keys.includes(absent), `${absent} does not belong here`)
})

test('an inequality answer adds the relations', () => {
  const keys = (show({ kind: 'expression', canonical: 'x>5' }), keyNames())
  for (const present of ['x', '+', '−', '<', '>']) {
    assert.ok(keys.includes(present), `${present} is missing from an inequality keypad`)
  }
})

test('a choice answer shows its options instead of a keypad', () => {
  const keys = (show({ kind: 'choice', value: '<', options: ['<', '=', '>'] }), keyNames())
  assert.deepEqual(keys, ['<', '=', '>'])
})

test('pressing a key reports it', () => {
  const onKey = show({ kind: 'expression', canonical: 'x>5' })
  fireEvent.click(screen.getByRole('button', { name: 'x, the unknown' }))
  fireEvent.click(screen.getByRole('button', { name: 'Greater than' }))
  assert.deepEqual(onKey.mock.calls.flat(), ['x', '>'])
})

test('every key is disabled while feedback is showing', () => {
  render(
    <Keypad answer={{ kind: 'integer', value: 5 }} onKey={() => {}} onSubmit={() => {}}
      canSubmit disabled />,
  )
  const enabled = [...document.querySelectorAll('button')].filter((b) => !(b as HTMLButtonElement).disabled)
  assert.deepEqual(enabled, [], 'a learner must not answer twice by tapping through feedback')
})
