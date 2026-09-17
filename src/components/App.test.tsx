// @vitest-environment jsdom
import { test, afterEach, beforeEach, expect } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { App } from './App'


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

test('a new learner meets the level check once someone is chosen', async () => {
  render(<App />)
  await settle()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Eddie' } })
  fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))
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
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Eddie' } })
  fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))
  await settle()
  await sitTheQuiz()

  assert.match(document.body.textContent ?? '', /Level check/i, 'the result is stated')
  expect(screen.getByRole('button', { name: /Start practising/i })).toBeTruthy()
  // Not the map yet.
  assert.doesNotMatch(document.body.textContent ?? '', /Session length/i)
})

/** The app picks the topic, so continuing lands in a session rather than a menu. */
test('continuing from the result starts practising straight away', async () => {
  render(<App />)
  await settle()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Eddie' } })
  fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))
  await settle()
  await sitTheQuiz()

  fireEvent.click(screen.getByRole('button', { name: /Start practising/i }))
  await settle()
  await atPractice()
})

test('the result is not shown again on the next visit', async () => {
  const { unmount } = render(<App />)
  await settle()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Eddie' } })
  fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))
  await settle()
  await sitTheQuiz()
  fireEvent.click(screen.getByRole('button', { name: /Start practising/i }))
  await settle()
  unmount()

  render(<App />)
  await settle()
  await atPractice()
  assert.doesNotMatch(document.body.textContent ?? '', /Start practising/,
    'the result belongs to the moment, not to every launch')
})

test('retaking from the result starts the questions again', async () => {
  render(<App />)
  await settle()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Eddie' } })
  fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))
  await settle()
  await sitTheQuiz()

  fireEvent.click(screen.getByRole('button', { name: /take the questions again/i }))
  await settle()
  assert.match(document.body.textContent ?? '', /find your level/i)
})

test('the placement is saved even if they close the app on the result screen', async () => {
  render(<App />)
  await settle()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Eddie' } })
  fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))
  await settle()
  await sitTheQuiz()

  // Progress lives under the profile's own key now, not the single shared one.
  const state = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '{}')
  const saved = localStorage.getItem(progressKeyFor(state.profiles[0].id))
  assert.ok(saved, 'nothing was written')
  assert.equal(JSON.parse(saved).placementDone, true,
    'closing the tab here must not mean sitting the quiz again')
})

// ---- profiles -------------------------------------------------------------
// localStorage is per-browser, not per-person: before this, two children
// sharing a device overwrote each other's journeys.

import { PROFILES_KEY, progressKeyFor } from '@/lib/mastery/profiles'

const addSomeone = async (name: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))
  await settle()
}

test('a first-time device asks who is practising before anything else', async () => {
  render(<App />)
  await settle()
  assert.match(document.body.textContent ?? '', /who.s practising/i)
  assert.doesNotMatch(document.body.textContent ?? '', /find your level/i)
})

test('adding someone takes them straight into the level check', async () => {
  render(<App />)
  await settle()
  await addSomeone('Eddie')
  assert.match(document.body.textContent ?? '', /find your level/i)
})

/** In a session, which is where the app now opens. */
const atPractice = () =>
  waitFor(() => expect(screen.getByRole('button', { name: /See how/i })).toBeTruthy())

/** The map is a progress view now, one tap from whatever they are doing. */
async function goToProgress() {
  await atPractice()
  fireEvent.click(screen.getByRole('button', { name: /See how/i }))
  await settle()
  await waitFor(() => assert.match(document.body.textContent ?? '', /Topics/))
}

test('two children keep separate journeys on one device', async () => {
  render(<App />)
  await settle()
  await addSomeone('Eddie')
  await sitTheQuiz()
  fireEvent.click(screen.getByRole('button', { name: /Start practising/i }))
  await settle()

  const saved = JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '{}')
  const eddie = saved.profiles[0].id
  assert.ok(localStorage.getItem(progressKeyFor(eddie)), "Eddie's journey is under his own key")

  // Ethan starts fresh rather than inheriting Eddie's placement.
  await goToProgress()
  fireEvent.click(screen.getByRole('button', { name: /Switch/i }))
  await settle()
  await addSomeone('Ethan')
  assert.match(document.body.textContent ?? '', /find your level/i,
    'Ethan should sit his own level check, not inherit one')
})

test('the active profile is remembered on the next visit', async () => {
  const { unmount } = render(<App />)
  await settle()
  await addSomeone('Eddie')
  await sitTheQuiz()
  fireEvent.click(screen.getByRole('button', { name: /Start practising/i }))
  await settle()
  unmount()

  render(<App />)
  await settle()
  await atPractice()
  assert.doesNotMatch(document.body.textContent ?? '', /who.s practising/i,
    'a child should not pick themselves out of a list every single time')
})

/**
 * The topic must not change out from under a session in progress.
 *
 * It was being recomputed at render time, and answering a question changes what
 * is weakest — so on a fresh launch, which is every launch, the app swapped
 * topic after one question and started the count again. The same shape of bug
 * as the session that used to restart on every answer.
 */
test('the topic stays put while a session is being answered', async () => {
  seedJourney()
  render(<App />)
  await settle()
  await atPractice()

  const topicAtStart = topicOnScreen()
  assert.ok(topicAtStart, 'a session should be under way')

  for (let i = 0; i < 4; i++) {
    fireEvent.keyDown(window, { key: '0' })
    fireEvent.keyDown(window, { key: 'Enter' })
    await act(async () => {})
  }

  assert.equal(topicOnScreen(), topicAtStart,
    'answering must not hand them a different topic half way through')
  assert.doesNotMatch(document.body.textContent ?? '', /·\s*1 \/ 20/,
    'nor start the count again')
})

/** The label in the back link, which names the topic in hand. */
const topicOnScreen = () =>
  screen.getByRole('button', { name: /See how/i }).textContent?.replace('←', '').trim()

/** A learner part way through, weak at one topic and placed through to it. */
function seedJourney() {
  const id = 'p_seed'
  localStorage.setItem(PROFILES_KEY, JSON.stringify({
    profiles: [{ id, name: 'Eddie' }], activeId: id,
  }))
  localStorage.setItem(progressKeyFor(id), JSON.stringify({
    facts: {},
    skills: {
      'a-add-3digit': {
        skill: 'a-add-3digit', attempts: 14,
        recent: [false, true, false, false, true, false, true, false, false, false],
        lastSeenAt: 0,
      },
    },
    placed: ['n-bonds-10', 'n-compare-20', 'n-place-value-100', 'n-place-value-1000', 'n-round',
      'a-add-within-10', 'a-sub-within-10', 'a-add-within-20', 'a-sub-within-20',
      'a-add-2digit', 'a-add-2digit-regroup', 'a-sub-2digit', 'a-sub-2digit-regroup', 'a-add-3digit'],
    placementDone: true,
  }))
}
