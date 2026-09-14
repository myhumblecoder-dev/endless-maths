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
  assert.equal(feedbackText(true, '8'), 'Correct')
})

test('a wrong answer labels the answer rather than showing a bare number', () => {
  assert.equal(feedbackText(false, '8'), 'Answer: 8')
  assert.equal(feedbackText(false, '−23'), 'Answer: −23')
})
