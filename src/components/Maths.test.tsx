// @vitest-environment jsdom
import { test, afterEach, expect } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, cleanup } from '@testing-library/react'
import { Maths } from './Maths'

afterEach(cleanup)

/** The numerator and denominator of the first stacked fraction on screen. */
function stacked(): { num: string; den: string } | undefined {
  const el = document.querySelector('[data-fraction]')
  if (!el) return undefined
  const [num, den] = [...el.querySelectorAll('[data-part]')].map((n) => n.textContent ?? '')
  return { num, den }
}

test('plain text renders as itself', () => {
  render(<Maths text="7 × 8" />)
  expect(screen.getByText('7 × 8')).toBeTruthy()
  assert.equal(stacked(), undefined, 'nothing to stack here')
})

/** Inline "3/4" is not how a fraction is written, and it misreads as division. */
test('a fraction renders stacked', () => {
  render(<Maths text="3/4" />)
  assert.deepEqual(stacked(), { num: '3', den: '4' })
})

test('a fraction inside a sentence is stacked in place', () => {
  render(<Maths text="1/2 + 1/3" />)
  const parts = [...document.querySelectorAll('[data-fraction]')]
  assert.equal(parts.length, 2, 'both fractions stack')
  assert.match(document.body.textContent ?? '', /\+/, 'the operator survives')
})

test('a negative fraction keeps its sign outside the stack', () => {
  render(<Maths text="-3/4" />)
  assert.deepEqual(stacked(), { num: '3', den: '4' })
  assert.match(document.body.textContent ?? '', /−|-/, 'the minus is still shown')
})

test('a half-typed fraction still renders', () => {
  // The learner is mid-entry: "3/" must not crash or vanish.
  render(<Maths text="3/" />)
  assert.match(document.body.textContent ?? '', /3/)
})

test('a mixed number keeps its whole part alongside the stack', () => {
  render(<Maths text="1 3/4" />)
  assert.deepEqual(stacked(), { num: '3', den: '4' })
  assert.match(document.body.textContent ?? '', /1/)
})

test('a date-like or division prompt is not mangled', () => {
  render(<Maths text="36 ÷ 9" />)
  assert.equal(stacked(), undefined)
  expect(screen.getByText('36 ÷ 9')).toBeTruthy()
})
