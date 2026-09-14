// @vitest-environment jsdom
import { test, afterEach, expect } from 'vitest'
import assert from 'node:assert/strict'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { Practice } from './Practice'
import { emptyProgress, type Progress } from '@/lib/mastery/mastery'
import type { ImplementedSkill } from '@/lib/problems'

afterEach(cleanup)

/**
 * Mirrors what App does: holds progress and feeds it back down. Without this
 * the session-restart bug is invisible, because that bug only appears when the
 * parent re-renders Practice with new progress after every answer.
 */
function Harness({ skill = 'a-add-within-10' as ImplementedSkill }) {
  const [progress, setProgress] = useState<Progress>(() => ({
    ...emptyProgress(),
    placed: ['n-bonds-10', 'n-compare-20', 'a-add-within-10', 'a-sub-within-10', 'a-add-within-20'],
    placementDone: true,
  }))
  return <Practice skill={skill} progress={progress} onProgress={setProgress} onLeave={() => {}} />
}

/** The prompt is the big heading-sized paragraph; read it back and solve it. */
function currentPrompt(): string {
  const el = [...document.querySelectorAll('p')].find((p) => /^\d+\s*[+−]\s*\d+$/.test(p.textContent ?? ''))
  assert.ok(el, `no arithmetic prompt on screen; body was:\n${document.body.textContent}`)
  return el.textContent!.trim()
}

function solve(prompt: string): number {
  const m = prompt.match(/^(\d+)\s*([+−])\s*(\d+)$/)
  assert.ok(m, `cannot solve "${prompt}"`)
  return m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]
}

const type = (text: string) => {
  for (const ch of text) fireEvent.keyDown(window, { key: ch })
}

const counter = () => screen.getByText(/\d+ \/ 20/).textContent!.trim()

test('the progress counter advances instead of restarting the session', async () => {
  render(<Harness />)
  assert.equal(counter(), '1 / 20')

  type(String(solve(currentPrompt())))
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(screen.getByText(/Correct/)).toBeTruthy()

  // Let the feedback timer elapse.
  await act(async () => { await new Promise((r) => setTimeout(r, 900)) })
  assert.equal(counter(), '2 / 20', 'answering must advance, not restart the session')
})

/**
 * The bug reported from real use: keys pressed while the outcome is on screen
 * were dropped, so "12" was submitted as "2" and a correct answer marked wrong.
 */
test('a key pressed during feedback is kept, not swallowed', async () => {
  render(<Harness />)

  type(String(solve(currentPrompt())))
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(screen.getByText(/Correct/)).toBeTruthy()

  // Type ahead, exactly as someone answering at speed does.
  fireEvent.keyDown(window, { key: '1' })
  fireEvent.keyDown(window, { key: '2' })

  expect(screen.queryByText(/Correct/)).toBeNull()
  expect(screen.getByText('12')).toBeTruthy()
  assert.equal(counter(), '2 / 20', 'typing ahead should also have advanced the problem')
})

test('a correct answer is celebrated and a wrong one names the answer', async () => {
  render(<Harness />)

  const wrong = solve(currentPrompt()) + 1
  type(String(wrong))
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(screen.getByText(/Answer:/)).toBeTruthy()

  await act(async () => { await new Promise((r) => setTimeout(r, 1700)) })
  type(String(solve(currentPrompt())))
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(screen.getByText(/Correct/)).toBeTruthy()
})

test('an incomplete entry cannot be submitted', () => {
  render(<Harness />)
  const check = screen.getByRole('button', { name: 'Check' }) as HTMLButtonElement
  assert.equal(check.disabled, true, 'Check must be disabled with nothing entered')

  fireEvent.keyDown(window, { key: '5' })
  assert.equal(check.disabled, false)

  fireEvent.keyDown(window, { key: 'Backspace' })
  assert.equal(check.disabled, true, 'Check must be disabled again once cleared')
})

test('the keypad is not clickable while feedback is showing', async () => {
  render(<Harness />)
  type(String(solve(currentPrompt())))
  fireEvent.keyDown(window, { key: 'Enter' })

  const seven = screen.getByRole('button', { name: '7' }) as HTMLButtonElement
  assert.equal(seven.disabled, true, 'a child must not double-answer by tapping through feedback')
})

// Twenty problems at ~800ms of feedback each needs more than the 5s default.
test('the whole session can be played to the summary screen', { timeout: 40_000 }, async () => {
  render(<Harness />)

  for (let i = 0; i < 20; i++) {
    type(String(solve(currentPrompt())))
    fireEvent.keyDown(window, { key: 'Enter' })
    await act(async () => { await new Promise((r) => setTimeout(r, 800)) })
  }

  // Answered correctly throughout, so the score is a clean sweep.
  assert.match(document.body.textContent ?? '', /20\s*\/\s*20/)
  expect(screen.getByRole('button', { name: /^Again$/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Choose another topic/ })).toBeTruthy()
})
