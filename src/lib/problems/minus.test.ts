import { test } from 'vitest'
import assert from 'node:assert/strict'
import { generate, seeded, DIFFICULTIES, IMPLEMENTED } from './index'

/**
 * Every negative in a prompt is written with a typographic minus. An ASCII
 * hyphen appearing alongside one puts two different characters for the same
 * idea into the same line of maths.
 */
test('prompts never mix an ASCII hyphen into their minus signs', () => {
  const offenders = new Set<string>()
  for (const skill of IMPLEMENTED) {
    for (const level of DIFFICULTIES) {
      const rng = seeded(31)
      for (let i = 0; i < 400; i++) {
        const { prompt } = generate(skill, rng, level)
        if (prompt.includes('-')) offenders.add(`${skill} at ${level}: ${prompt}`)
      }
    }
  }
  assert.deepEqual([...offenders], [])
})
