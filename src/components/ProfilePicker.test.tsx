// @vitest-environment jsdom
import { test, afterEach, expect, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ProfilePicker } from './ProfilePicker'
import type { ProfileState } from '@/lib/mastery/profiles'

afterEach(cleanup)

const two: ProfileState = {
  profiles: [
    { id: 'p1', name: 'Eddie', createdAt: 0 },
    { id: 'p2', name: 'Ethan', createdAt: 0 },
  ],
  activeId: null,
}

const show = (state: ProfileState, props: Partial<Parameters<typeof ProfilePicker>[0]> = {}) => {
  const handlers = { onChoose: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn() }
  render(<ProfilePicker state={state} {...handlers} {...props} />)
  return handlers
}

test('everyone on the device is listed by name', () => {
  show(two)
  expect(screen.getByRole('button', { name: 'Eddie' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ethan' })).toBeTruthy()
})

test('choosing someone reports who', () => {
  const { onChoose } = show(two)
  fireEvent.click(screen.getByRole('button', { name: 'Ethan' }))
  assert.deepEqual(onChoose.mock.calls, [['p2']])
})

test('a first-time device asks who is practising', () => {
  show({ profiles: [], activeId: null })
  assert.match(document.body.textContent ?? '', /who/i)
  expect(screen.getByRole('button', { name: /Add/i })).toBeTruthy()
})

test('a name can be added', () => {
  const { onAdd } = show({ profiles: [], activeId: null })
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Eddie' } })
  fireEvent.click(screen.getByRole('button', { name: /Add/i }))
  assert.deepEqual(onAdd.mock.calls, [['Eddie']])
})

test('an empty name is not accepted', () => {
  const { onAdd } = show({ profiles: [], activeId: null })
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: /Add/i }))
  assert.equal(onAdd.mock.calls.length, 0, 'a blank profile helps nobody')
})

/** Deleting destroys a journey, so it takes two deliberate actions. */
test('removing someone takes a confirmation', () => {
  const { onRemove } = show(two)

  fireEvent.click(screen.getByRole('button', { name: /Remove Eddie/i }))
  assert.equal(onRemove.mock.calls.length, 0, 'one tap must not destroy a journey')

  fireEvent.click(screen.getByRole('button', { name: /Yes, delete/i }))
  assert.deepEqual(onRemove.mock.calls, [['p1']])
})

test('the confirmation says what will be lost', () => {
  show(two)
  fireEvent.click(screen.getByRole('button', { name: /Remove Eddie/i }))
  assert.match(document.body.textContent ?? '', /progress|journey|practice/i)
})

test('a removal can be backed out of', () => {
  const { onRemove } = show(two)
  fireEvent.click(screen.getByRole('button', { name: /Remove Eddie/i }))
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
  assert.equal(onRemove.mock.calls.length, 0)
  expect(screen.getByRole('button', { name: 'Eddie' })).toBeTruthy()
})
