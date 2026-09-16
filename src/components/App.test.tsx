// @vitest-environment jsdom
import { test, afterEach, beforeEach, expect } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { App } from './App'
import { STORAGE_KEY } from '@/lib/mastery/storage'

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); localStorage.clear() })

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)) })

/** Work through the level check by skipping every question. */
async function sitTheQuiz(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const skip = screen.queryByRole('button', { name: /^Skip$/ })
    if (!skip) return
    fireEvent.click(skip)
    await settle()
  }
  assert.fail('the level check did not finish')
}

test('a new learner meets the level check first', async () => {
  render(<App />)
  await settle()
  assert.match(document.body.textContent ?? '', /find your level/i)
})

/**
 * Observed with two real learners: the quiz ended by dropping them straight
 * onto the topic map, and neither they nor their parent could tell where it had
 * put them.
 */
test('the quiz shows its result before the topic map', async () => {
  render(<App />)
  await settle()
  await sitTheQuiz()

  assert.match(document.body.textContent ?? '', /Level check/i, 'the result is stated')
  expect(screen.getByRole('button', { name: /Start practising/i })).toBeTruthy()
  // Not the map yet.
  assert.doesNotMatch(document.body.textContent ?? '', /Session length/i)
})

test('continuing from the result reaches the topics', async () => {
  render(<App />)
  await settle()
  await sitTheQuiz()

  fireEvent.click(screen.getByRole('button', { name: /Start practising/i }))
  await settle()
  await waitFor(() => assert.match(document.body.textContent ?? '', /Topics/))
})

test('the result is not shown again on the next visit', async () => {
  const { unmount } = render(<App />)
  await settle()
  await sitTheQuiz()
  fireEvent.click(screen.getByRole('button', { name: /Start practising/i }))
  await settle()
  unmount()

  render(<App />)
  await settle()
  await waitFor(() => assert.match(document.body.textContent ?? '', /Topics/))
  assert.doesNotMatch(document.body.textContent ?? '', /Start practising/,
    'the result belongs to the moment, not to every launch')
})

test('retaking from the result starts the questions again', async () => {
  render(<App />)
  await settle()
  await sitTheQuiz()

  fireEvent.click(screen.getByRole('button', { name: /take the questions again/i }))
  await settle()
  assert.match(document.body.textContent ?? '', /find your level/i)
})

test('the placement is saved even if they close the app on the result screen', async () => {
  render(<App />)
  await settle()
  await sitTheQuiz()

  const saved = localStorage.getItem(STORAGE_KEY)
  assert.ok(saved, 'nothing was written')
  assert.equal(JSON.parse(saved).placementDone, true,
    'closing the tab here must not mean sitting the quiz again')
})
