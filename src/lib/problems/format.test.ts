import { test } from 'vitest'
import assert from 'node:assert/strict'
import { feedbackText, formatAnswer } from './format'

test('integers show plainly', () => {
  assert.equal(formatAnswer({ kind: 'integer', value: 56 }), '56')
})

test('negatives use a real minus sign, matching the prompts', () => {
  assert.equal(formatAnswer({ kind: 'integer', value: -8 }), '−8')
})

test('decimals keep their trailing zeros', () => {
  assert.equal(formatAnswer({ kind: 'decimal', value: 2.1, dp: 2 }), '2.10')
  assert.equal(formatAnswer({ kind: 'decimal', value: 17.6, dp: 1 }), '17.6')
})

test('choices show as written', () => {
  assert.equal(formatAnswer({ kind: 'choice', value: 'yes', options: ['yes', 'no'] }), 'yes')
})

// ---- feedback -------------------------------------------------------------

// Pitched for 11-13s. Retrieval practice works best when it "feels like
// practice, not constant judgement", so the wording stays flat and factual —
// no exclamation, no praise, no commiseration.
test('a correct answer is confirmed without fuss', () => {
  assert.equal(feedbackText('correct', '8'), 'Correct')
})

test('a wrong answer labels the answer rather than showing a bare number', () => {
  assert.equal(feedbackText('incorrect', '8'), 'Answer: 8')
  assert.equal(feedbackText('incorrect', '−23'), 'Answer: −23')
})

// ---- fractions ------------------------------------------------------------

test('fractions format as they are written', () => {
  assert.equal(formatAnswer({ kind: 'fraction', num: 3, den: 4 }), '3/4')
  assert.equal(formatAnswer({ kind: 'fraction', num: -3, den: 4 }), '−3/4')
  assert.equal(formatAnswer({ kind: 'mixed', whole: 1, num: 3, den: 4 }), '1 3/4')
})

/**
 * The third verdict needs its own words. "Correct" would silently accept an
 * unfinished answer; "Answer: 3/4" would imply they were wrong. Neither is true.
 */
test('an unsimplified answer is told it is right but unfinished', () => {
  const text = feedbackText('equivalent-unsimplified', '3/4')
  assert.match(text, /simplif/i, 'it must name what is left to do')
  assert.doesNotMatch(text, /^Correct$/, 'it is not finished')
  assert.doesNotMatch(text, /Answer:/, 'they were not wrong')
})

test('the existing two verdicts are unchanged', () => {
  assert.equal(feedbackText('correct', '8'), 'Correct')
  assert.equal(feedbackText('incorrect', '8'), 'Answer: 8')
})
