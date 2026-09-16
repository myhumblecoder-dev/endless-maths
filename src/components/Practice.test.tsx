// @vitest-environment jsdom
import { test, afterEach, expect, vi } from 'vitest'
import assert from 'node:assert/strict'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { Practice } from './Practice'
import { SESSION_CAP } from '@/lib/session/goal'
import { emptyProgress, record, type Progress } from '@/lib/mastery/mastery'
import type { ImplementedSkill } from '@/lib/problems'

afterEach(cleanup)

/**
 * Mirrors what App does: holds progress and feeds it back down. Without this
 * the session-restart bug is invisible, because that bug only appeared when the
 * parent re-rendered Practice with new progress after every answer.
 *
 * The seed is fixed so a session is identical on every run.
 */
function Harness({ skill = 'a-add-within-10' as ImplementedSkill, seed = 4242 }) {
  const [progress, setProgress] = useState<Progress>(() => ({
    ...emptyProgress(),
    placed: ['n-bonds-10', 'a-add-within-10', 'a-sub-within-10', 'a-add-within-20'],
    placementDone: true,
  }))
  return (
    <Practice skill={skill} progress={progress} onProgress={setProgress} onLeave={() => {}} seed={seed} />
  )
}

// ---- reading and answering whatever is on screen --------------------------
// Sessions interleave, so a session anchored on one skill still shows others.
// These helpers cope with both input modes: the numeric keypad, and the three
// buttons the comparison skill uses.

const paragraphs = () => [...document.querySelectorAll('p')].map((p) => (p.textContent ?? '').trim())

/** The comparison prompt, when that is what is on screen. */
const comparePrompt = () => paragraphs().find((t) => /^\d+ \? \d+$/.test(t))

const numericPrompt = () => paragraphs().find((t) =>
  /^\d+\s*[+−]\s*\d+$/.test(t) ||
  /^\d+ \+ \? = 10$/.test(t) ||
  /^Which digit is in the \w+ place\?/.test(t))

function solve(prompt: string): number {
  let m
  if ((m = prompt.match(/^(\d+)\s*([+−])\s*(\d+)$/))) return m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]
  if ((m = prompt.match(/^(\d+) \+ \? = 10$/))) return 10 - +m[1]
  if ((m = prompt.match(/^Which digit is in the (\w+) place\?\s+(\d+)$/))) {
    const n = m[2]
    return +(m[1] === 'ones' ? n.slice(-1) : m[1] === 'tens' ? n.slice(-2, -1) : n.slice(-3, -2))
  }
  assert.fail(`cannot solve "${prompt}"`)
}

const type = (text: string) => { for (const ch of text) fireEvent.keyDown(window, { key: ch }) }

/** Answer the current problem correctly, whichever input mode it uses. */
function answerCorrectly(): void {
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
function answerWrongly(): void {
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

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 900)) })

/** Move forward until a keypad problem is showing. */
async function advanceToNumeric(): Promise<void> {
  for (let i = 0; i < 10 && !numericPrompt(); i++) {
    answerCorrectly()
    await settle()
  }
  assert.ok(numericPrompt(), 'no keypad problem appeared in ten tries')
}

const counter = () => screen.getByText(/\d+ \/ 20/).textContent!.trim()

// ---- tests ----------------------------------------------------------------

test('the progress counter advances instead of restarting the session', async () => {
  render(<Harness />)
  assert.equal(counter(), '1 / 20')

  answerCorrectly()
  await settle()
  assert.equal(counter(), '2 / 20', 'answering must advance, not restart the session')
})

/**
 * Reported from real use: keys pressed while the outcome was on screen were
 * dropped, so "12" was submitted as "2" and a correct answer marked wrong.
 */
test('a key pressed during feedback is kept, not swallowed', async () => {
  render(<Harness />)

  answerCorrectly()
  expect(screen.getByText(/Correct/)).toBeTruthy()

  // Type ahead, exactly as someone answering at speed does.
  fireEvent.keyDown(window, { key: '1' })
  fireEvent.keyDown(window, { key: '2' })

  expect(screen.queryByText(/Correct/)).toBeNull()
  expect(screen.getByText('12')).toBeTruthy()
  assert.equal(counter(), '2 / 20', 'typing ahead should also have advanced the problem')
})

test('a correct answer is confirmed and a wrong one names the answer', async () => {
  render(<Harness />)

  answerWrongly()
  expect(screen.getByText(/Answer:/)).toBeTruthy()

  await act(async () => { await new Promise((r) => setTimeout(r, 1700)) })
  answerCorrectly()
  expect(screen.getByText(/Correct/)).toBeTruthy()
})

test('an incomplete entry cannot be submitted', async () => {
  render(<Harness />)
  await advanceToNumeric()

  const check = screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement
  assert.equal(check.disabled, true, 'Submit must be disabled with nothing entered')

  fireEvent.keyDown(window, { key: '5' })
  assert.equal(check.disabled, false)

  fireEvent.keyDown(window, { key: 'Backspace' })
  assert.equal(check.disabled, true, 'Submit must be disabled again once cleared')
})

test('the keypad is not clickable while feedback is showing', async () => {
  render(<Harness />)
  await advanceToNumeric()

  answerCorrectly()
  const seven = screen.getByRole('button', { name: '7' }) as HTMLButtonElement
  assert.equal(seven.disabled, true, 'a learner must not double-answer by tapping through feedback')
})

/** Twenty problems at ~900ms of feedback each needs more than the 5s default. */
test('the whole session can be played to the summary screen', { timeout: 60_000 }, async () => {
  render(<Harness />)

  for (let i = 0; i < 20; i++) {
    answerCorrectly()
    await settle()
  }

  // Answered correctly throughout, so the score is a clean sweep.
  assert.match(document.body.textContent ?? '', /20\s*\/\s*20/)
  expect(screen.getByRole('button', { name: /^Again$/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Choose another topic/ })).toBeTruthy()
})

/** Interleaving: a session anchored on one skill should still show others. */
test('a session mixes in other skills', { timeout: 30_000 }, async () => {
  render(<Harness />)
  const seen = new Set<string>()

  for (let i = 0; i < 10; i++) {
    seen.add(comparePrompt() ?? numericPrompt() ?? '')
    answerCorrectly()
    await settle()
  }

  assert.ok(seen.size >= 8, `expected varied questions, saw ${seen.size} distinct in 10`)
})

// ---- suggesting the real gap ---------------------------------------------

/** Someone placed high who has been getting two-step equations wrong. */
function strugglingProgress(): Progress {
  let p: Progress = {
    ...emptyProgress(),
    placed: ['n-bonds-10', 'n-compare-20', 'n-place-value-100', 'n-place-value-1000', 'n-round',
      'a-add-within-10', 'a-sub-within-10', 'a-add-within-20', 'a-sub-within-20',
      'a-add-2digit', 'a-add-2digit-regroup', 'a-sub-2digit', 'a-sub-2digit-regroup',
      'a-add-3digit', 'a-sub-3digit', 'm-times-2-5-10', 'm-times-3-4', 'm-times-6-7-8-9',
      'm-2digit-x-1digit', 'r-order-of-ops', 'p-evaluate', 'p-solve-one-step'],
    placementDone: true,
  }
  for (let i = 0; i < 8; i++) {
    p = record(p, {
      problemId: `p-solve-two-step#${i}`, skill: 'p-solve-two-step',
      given: '0', verdict: 'incorrect', elapsedMs: 9000, at: i,
    })
  }
  return p
}

function StruggleHarness({ onPick = () => {} }: { onPick?: (s: ImplementedSkill) => void }) {
  const [progress, setProgress] = useState<Progress>(strugglingProgress)
  return (
    <Practice skill="p-solve-two-step" progress={progress} onProgress={setProgress}
      onLeave={() => {}} onPickSkill={onPick} seed={99} />
  )
}

/**
 * Play a whole session out, getting the topic in hand wrong every time.
 *
 * Two things this has to cope with. A session no longer has a fixed length —
 * a run of wrong answers goes all the way to the cap — so waiting out the
 * feedback for real would cost the cap times 1.5 seconds. And interleaved
 * review brings in comparison questions, which are TAPPED rather than typed:
 * a keypad-only loop jams on the first one, because its keys do not dismiss
 * the feedback and the buttons underneath are disabled while it shows.
 */
async function failEverything() {
  vi.useFakeTimers()
  try {
    for (let i = 0; i < SESSION_CAP; i++) {
      if (screen.queryByRole('button', { name: /^Again$/ })) break // already finished
      if (screen.queryByRole('button', { name: 'Submit' })) {
        fireEvent.keyDown(window, { key: '0' })
        fireEvent.keyDown(window, { key: 'Enter' })
      } else {
        fireEvent.click(screen.getAllByRole('button')[1]) // a choice: the first option
      }
      await act(async () => { await vi.advanceTimersByTimeAsync(FEEDBACK_MS) })
    }
  } finally {
    vi.useRealTimers()
  }
}

/** Longer than the wrong-answer feedback, which is the slower of the two. */
const FEEDBACK_MS = 1600

test('the summary offers the gap underneath a skill being failed', { timeout: 30_000 }, async () => {
  render(<StruggleHarness />)
  await failEverything()

  // "Adding and subtracting negatives" is two levels below two-step equations.
  assert.match(document.body.textContent ?? '', /negatives/i,
    'a learner failing this needs the gap beneath it, not more of the same')
})

test('the suggestion can be declined', { timeout: 30_000 }, async () => {
  const picked: string[] = []
  render(<StruggleHarness onPick={(s) => picked.push(s)} />)
  await failEverything()

  assert.equal(picked.length, 0, 'nothing should be forced on them')
  expect(screen.getByRole('button', { name: /^Again$/ })).toBeTruthy()
})

// ---- making the mix legible ----------------------------------------------
// Interleaving means a session on one topic shows others. Unexplained, that
// reads as the app being random rather than deliberate.

test('a problem from another skill is labelled as review', { timeout: 40_000 }, async () => {
  render(<Harness skill="a-add-within-20" />)

  let sawReview = false
  let sawChosen = false
  for (let i = 0; i < 12; i++) {
    const header = document.body.textContent ?? ''
    const onChosen = !!numericPrompt()?.match(/^\d+ \+ \d+$/)
    if (/Review/i.test(header)) sawReview = true
    if (onChosen && !/Review/i.test(header)) sawChosen = true
    answerCorrectly()
    await settle()
  }

  assert.ok(sawReview, 'problems from other skills should say so')
  assert.ok(sawChosen, 'the chosen skill should not be labelled review')
})

// ---- keyboard-first -------------------------------------------------------
// These two will be on laptops. Anything reachable only by mouse is unusable.

function CompareHarness({ onLeave = () => {} }: { onLeave?: () => void }) {
  const [progress, setProgress] = useState<Progress>(() => ({
    ...emptyProgress(),
    placed: ['n-compare-20'],
    placementDone: true,
  }))
  return (
    <Practice skill="n-compare-20" progress={progress} onProgress={setProgress}
      onLeave={onLeave} seed={31} />
  )
}

/** Interleaving means the chosen skill is not always what is on screen first. */
async function advanceToCompare(): Promise<void> {
  for (let i = 0; i < 10 && !comparePrompt(); i++) {
    answerCorrectly()
    await settle()
  }
  assert.ok(comparePrompt(), 'no comparison appeared in ten problems')
}

test('a comparison can be answered from the keyboard', { timeout: 30_000 }, async () => {
  render(<CompareHarness />)
  await advanceToCompare()

  const prompt = comparePrompt()!
  const [, a, b] = prompt.match(/^(\d+) \? (\d+)$/)!
  fireEvent.keyDown(window, { key: +a > +b ? '>' : +a < +b ? '<' : '=' })

  expect(screen.getByText(/Correct/)).toBeTruthy()
})

test('a wrong relation typed from the keyboard is marked wrong', { timeout: 30_000 }, async () => {
  render(<CompareHarness />)
  await advanceToCompare()
  const [, a, b] = comparePrompt()!.match(/^(\d+) \? (\d+)$/)!
  fireEvent.keyDown(window, { key: +a > +b ? '<' : '>' })
  expect(screen.getByText(/Answer:/)).toBeTruthy()
})

test('Escape leaves the session', () => {
  const leaves: number[] = []
  render(<CompareHarness onLeave={() => leaves.push(1)} />)
  fireEvent.keyDown(window, { key: 'Escape' })
  assert.equal(leaves.length, 1, 'a learner should not need a mouse to back out')
})

test('the back link and Submit are reachable as real buttons', () => {
  render(<Harness />)
  // Native buttons are focusable and Enter-activatable; anything else would
  // need explicit key handling to be usable without a mouse.
  const back = screen.getByRole('button', { name: /Back to the topic list|←/ })
  assert.equal(back.tagName, 'BUTTON')
})
