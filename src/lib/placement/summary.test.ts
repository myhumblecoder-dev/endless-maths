import { test } from 'vitest'
import assert from 'node:assert/strict'
import { placementSummary } from './summary'
import { emptyProgress, type Progress } from '@/lib/mastery/mastery'
import { IMPLEMENTED } from '@/lib/problems'

const placedWith = (...skills: string[]): Progress => ({
  ...emptyProgress(),
  placed: skills as Progress['placed'],
  placementDone: true,
})

test('a beginner is told where they are starting, not what they failed', () => {
  const s = placementSummary(placedWith())
  assert.ok(s.startingWith.length > 0, 'there is always somewhere to start')
  assert.equal(s.placedOut, 0)
  // Being placed at the beginning is not a failure and must not read as one.
  assert.doesNotMatch(s.headline, /fail|wrong|sorry|only|unfortunately/i)
})

test('someone who placed out of work is told how much', () => {
  const s = placementSummary(placedWith('n-bonds-10', 'n-compare-20', 'n-place-value-100'))
  assert.equal(s.placedOut, 3)
})

test('the topics named are ones they can actually start on', () => {
  const s = placementSummary(placedWith('n-bonds-10', 'a-add-within-10', 'a-sub-within-10'))
  for (const topic of s.startingWith) {
    assert.ok(IMPLEMENTED.includes(topic.id), `${topic.id} has no generator`)
    assert.ok(topic.label.length > 0, 'child-facing labels, not skill ids')
    assert.ok(!/^[a-z]-/.test(topic.label), `"${topic.label}" looks like an id`)
  }
})

test('the list of topics stays short enough to read', () => {
  const s = placementSummary(placedWith(...IMPLEMENTED.slice(0, 20)))
  assert.ok(s.startingWith.length <= 4, `${s.startingWith.length} topics is a wall of text`)
})

test('someone who placed out of everything is still told something sensible', () => {
  const s = placementSummary(placedWith(...IMPLEMENTED))
  assert.equal(s.placedOut, IMPLEMENTED.length)
  assert.ok(s.headline.length > 0)
  assert.doesNotMatch(s.headline, /undefined|NaN/)
})

test('it is factual rather than congratulatory', () => {
  for (const progress of [placedWith(), placedWith(...IMPLEMENTED.slice(0, 10))]) {
    const s = placementSummary(progress)
    for (const word of ['great', 'amazing', 'well done', 'brilliant', 'congratulations']) {
      assert.doesNotMatch(s.headline, new RegExp(word, 'i'), `"${word}" is a prize, not a result`)
    }
  }
})
