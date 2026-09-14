import { test } from 'vitest'
import assert from 'node:assert/strict'
import { formatAnswer } from './format'

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
