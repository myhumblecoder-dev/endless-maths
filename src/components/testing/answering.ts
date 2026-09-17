/**
 * Reading and answering whatever question is on screen.
 *
 * Shared because sessions interleave: a session anchored on one skill shows
 * others, and any test that plays one through has to cope with every input mode
 * it might meet — the numeric keypad, and the three buttons the comparison
 * skill uses. A keypad-only loop silently jams on the first comparison, because
 * its keys do not dismiss the feedback and the buttons underneath are disabled
 * while it shows.
 *
 * Not a `.test.` file, so vitest does not try to run it.
 */

import assert from 'node:assert/strict'
import { screen, fireEvent, act } from '@testing-library/react'

export const paragraphs = (): string[] =>
  [...document.querySelectorAll('p')].map((p) => (p.textContent ?? '').trim())

/** The comparison prompt, when that is what is on screen. */
export const comparePrompt = (): string | undefined =>
  paragraphs().find((t) => /^\d+ \? \d+$/.test(t))

export const numericPrompt = (): string | undefined =>
  paragraphs().find((t) => SOLVABLE.some((r) => r.test(t)))

const SOLVABLE = [
  /^\d+\s*[+−×÷]\s*\d+$/,
  /^\d+ \+ \? = 10$/,
  /^Which digit is in the \w+ place\?/,
  /^Round \d+ to the nearest \d+$/,
  /^\d+²$/,
]

export function solve(prompt: string): number {
  let m
  if ((m = prompt.match(/^(\d+)\s*([+−×÷])\s*(\d+)$/))) {
    const [a, b] = [+m[1], +m[3]]
    return m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b
  }
  if ((m = prompt.match(/^(\d+) \+ \? = 10$/))) return 10 - +m[1]
  if ((m = prompt.match(/^Which digit is in the (\w+) place\?\s+(\d+)$/))) {
    const n = m[2]
    return +(m[1] === 'ones' ? n.slice(-1) : m[1] === 'tens' ? n.slice(-2, -1) : n.slice(-3, -2))
  }
  if ((m = prompt.match(/^Round (\d+) to the nearest (\d+)$/))) {
    return Math.round(+m[1] / +m[2]) * +m[2]
  }
  if ((m = prompt.match(/^(\d+)²$/))) return +m[1] * +m[1]
  assert.fail(`cannot solve "${prompt}"`)
}

export const type = (text: string): void => {
  for (const ch of text) fireEvent.keyDown(window, { key: ch })
}

/**
 * Get the outcome of the last answer off the screen, before reading the next
 * question.
 *
 * While feedback shows, the prompt on screen is still the one just answered, so
 * reading first means solving the previous question and submitting it against
 * the next one — a "clean" run that is nothing of the sort.
 *
 * Typed answers dismiss it with a keystroke, which the app supports on purpose
 * and which costs nothing. Tapped ones — the comparison questions — have to be
 * waited out, because their keys do not dismiss it and the buttons underneath
 * are disabled while it shows. Waiting out EVERY question instead turns a
 * three-second test into a minute-long one.
 */
export async function clearFeedback(): Promise<void> {
  if (screen.queryByRole('button', { name: 'Submit' })) {
    fireEvent.keyDown(window, { key: '0' })
    fireEvent.keyDown(window, { key: 'Backspace' })
    await act(async () => {})
  } else {
    await act(async () => { await new Promise((r) => setTimeout(r, 1600)) })
  }
}

/** Answer the current problem correctly, whichever input mode it uses. */
export function answerCorrectly(): void {
  const compare = comparePrompt()
  if (compare) {
    const [, a, b] = compare.match(/^(\d+) \? (\d+)$/)!
    fireEvent.click(screen.getByRole('button', { name: +a > +b ? '>' : +a < +b ? '<' : '=' }))
    return
  }
  const prompt = numericPrompt()
  assert.ok(prompt, `nothing answerable on screen:\n${document.body.textContent}`)
  type(String(solve(prompt)))
  fireEvent.keyDown(window, { key: 'Enter' })
}

/** Answer the current problem wrongly, whichever input mode it uses. */
export function answerWrongly(): void {
  const compare = comparePrompt()
  if (compare) {
    const [, a, b] = compare.match(/^(\d+) \? (\d+)$/)!
    fireEvent.click(screen.getByRole('button', { name: +a > +b ? '<' : '>' }))
    return
  }
  const prompt = numericPrompt()
  assert.ok(prompt, `nothing answerable on screen:\n${document.body.textContent}`)
  type(String(solve(prompt) + 1))
  fireEvent.keyDown(window, { key: 'Enter' })
}
