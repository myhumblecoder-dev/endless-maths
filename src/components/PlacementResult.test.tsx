// @vitest-environment jsdom
import { test, afterEach, expect, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PlacementResult } from './PlacementResult'
import { emptyProgress, type Progress } from '@/lib/mastery/mastery'
import { IMPLEMENTED } from '@/lib/problems'

afterEach(cleanup)

const placedWith = (...skills: string[]): Progress => ({
  ...emptyProgress(),
  placed: skills as Progress['placed'],
  placementDone: true,
})

const show = (progress: Progress, props: Partial<Parameters<typeof PlacementResult>[0]> = {}) =>
  render(
    <PlacementResult progress={progress} onContinue={() => {}} onRetake={() => {}} {...props} />,
  )

test('it says what the quiz decided', () => {
  show(placedWith('n-bonds-10', 'n-compare-20'))
  assert.match(document.body.textContent ?? '', /2 topics already covered/)
})

test('it names where they will start, in words a learner recognises', () => {
  show(placedWith('n-bonds-10'))
  const text = document.body.textContent ?? ''
  assert.match(text, /Bigger or smaller|Tens and ones|Taking away/i)
  assert.doesNotMatch(text, /[a-z]-[a-z]+-\d|n-bonds/, 'skill ids are not for reading')
})

test('a beginner is told where they start, not what they got wrong', () => {
  show(placedWith())
  const text = document.body.textContent ?? ''
  assert.match(text, /Starting from the beginning/)
  assert.doesNotMatch(text, /wrong|fail|sorry|only/i)
})

test('continuing goes on to the topics', () => {
  const onContinue = vi.fn()
  show(placedWith('n-bonds-10'), { onContinue })
  fireEvent.click(screen.getByRole('button', { name: /Start practising/i }))
  assert.equal(onContinue.mock.calls.length, 1)
})

/**
 * The moment to offer a retake is here, while the result is on screen and the
 * quiz is fresh — not buried at the foot of the map where nobody looks.
 */
test('the quiz can be retaken from the result', () => {
  const onRetake = vi.fn()
  show(placedWith('n-bonds-10'), { onRetake })
  fireEvent.click(screen.getByRole('button', { name: /take the questions again/i }))
  assert.equal(onRetake.mock.calls.length, 1)
})

test('someone who placed out of everything is not shown an empty list', () => {
  show(placedWith(...IMPLEMENTED))
  const text = document.body.textContent ?? ''
  assert.match(text, /everything|all of it|nothing left/i)
  expect(screen.getByRole('button', { name: /Start practising/i })).toBeTruthy()
})

test('the result is factual, not a prize or a telling-off', () => {
  for (const progress of [placedWith(), placedWith(...IMPLEMENTED.slice(0, 12))]) {
    cleanup()
    show(progress)
    const text = document.body.textContent ?? ''
    for (const word of ['great', 'amazing', 'well done', 'brilliant', 'oops', 'poor']) {
      assert.doesNotMatch(text, new RegExp(word, 'i'), `"${word}" is judgement, not a result`)
    }
  }
})
