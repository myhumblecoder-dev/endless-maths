// @vitest-environment jsdom
import { test, afterEach, beforeEach, expect, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SafeScreen } from './SafeScreen'
import { STORAGE_KEY } from '@/lib/mastery/storage'

afterEach(cleanup)

/** React logs the caught error; silence it so the suite output stays readable. */
beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { vi.restoreAllMocks() })

function Boom(): React.ReactNode {
  throw new Error('something broke deep in the render')
}

test('a healthy screen renders its children untouched', () => {
  render(<SafeScreen><p>practice goes here</p></SafeScreen>)
  expect(screen.getByText('practice goes here')).toBeTruthy()
})

/**
 * A child sitting alone must never meet a blank page. Anything that throws has
 * to become a friendly screen with a way out.
 */
test('a crash becomes a friendly screen, not a blank page', () => {
  render(<SafeScreen><Boom /></SafeScreen>)
  assert.match(document.body.textContent ?? '', /Something went wrong/i)
  expect(screen.getByRole('button', { name: /Start again/i })).toBeTruthy()
})

test('the crash screen never shows the technical error to a child', () => {
  render(<SafeScreen><Boom /></SafeScreen>)
  assert.doesNotMatch(
    document.body.textContent ?? '',
    /something broke deep in the render|Error:|stack/i,
    'error text is for the console, not for a seven-year-old',
  )
})

test('starting again clears the saved progress that may have caused it', () => {
  localStorage.setItem(STORAGE_KEY, '{"corrupt":true}')
  render(<SafeScreen><Boom /></SafeScreen>)

  const reload = vi.fn()
  vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as Location)

  fireEvent.click(screen.getByRole('button', { name: /Start again/i }))
  assert.equal(localStorage.getItem(STORAGE_KEY), null, 'bad progress must not survive the reset')
})
