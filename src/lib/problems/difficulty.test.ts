import { test } from 'vitest'
import assert from 'node:assert/strict'
import { DIFFICULTIES, easier, harder, isVaried } from './difficulty'
import { generate, seeded, IMPLEMENTED } from './index'
import { check } from './check'
import { formatAnswer } from './format'

test('there are three levels, easiest first', () => {
  assert.deepEqual([...DIFFICULTIES], ['simple', 'medium', 'difficult'])
})

test('the levels step up and down, and stop at the ends', () => {
  assert.equal(easier('difficult'), 'medium')
  assert.equal(easier('medium'), 'simple')
  assert.equal(easier('simple'), 'simple', 'there is nothing below simple')
  assert.equal(harder('simple'), 'medium')
  assert.equal(harder('difficult'), 'difficult', 'there is nothing above difficult')
})

/**
 * A level that changes nothing would be a lie told to a learner who was just
 * given "easier" work. Every skill that claims to vary must actually vary.
 */
test('a skill that claims to vary produces different problems at each level', () => {
  const offenders: string[] = []
  for (const skill of IMPLEMENTED.filter(isVaried)) {
    const at = (level: (typeof DIFFICULTIES)[number]) => {
      const rng = seeded(404)
      return new Set(Array.from({ length: 300 }, () => generate(skill, rng, level).prompt))
    }
    const simple = at('simple')
    const difficult = at('difficult')
    const overlap = [...simple].filter((p) => difficult.has(p)).length
    const share = overlap / simple.size
    if (share >= 0.5) offenders.push(`${skill} (${Math.round(share * 100)}% shared)`)
  }
  assert.deepEqual(offenders, [], 'these claim to vary but barely do')
})

test('every level still produces correct, gradeable problems', () => {
  for (const skill of IMPLEMENTED) {
    for (const level of DIFFICULTIES) {
      const rng = seeded(77)
      for (let i = 0; i < 200; i++) {
        const p = generate(skill, rng, level)
        assert.ok(p.prompt.length > 0, `${skill} at ${level}: empty prompt`)
        const typed = formatAnswer(p.answer).replace(/−/g, '-').replace(/ /g, '')
        assert.notEqual(check(p.answer, typed), 'incorrect',
          `${skill} at ${level}: "${p.prompt}" -> "${typed}" graded wrong`)
      }
    }
  }
})

test('every level has enough distinct problems to fill a session', () => {
  const thin: string[] = []
  for (const skill of IMPLEMENTED.filter(isVaried)) {
    for (const level of DIFFICULTIES) {
      const rng = seeded(9)
      const distinct = new Set(Array.from({ length: 2000 }, () => generate(skill, rng, level).prompt))
      if (distinct.size < 25) thin.push(`${skill} at ${level}: ${distinct.size}`)
    }
  }
  assert.deepEqual(thin, [], 'a session of twenty refuses to repeat a question')
})

test('omitting the level behaves exactly as medium', () => {
  for (const skill of IMPLEMENTED) {
    const a = seeded(5)
    const b = seeded(5)
    const without = Array.from({ length: 50 }, () => generate(skill, a).prompt)
    const medium = Array.from({ length: 50 }, () => generate(skill, b, 'medium').prompt)
    assert.deepEqual(without, medium, `${skill}: the default must not be a surprise`)
  }
})

test('a skill that does not vary says so rather than pretending', () => {
  // Being honest about it is what lets the app avoid claiming it made something
  // easier when it did not.
  assert.equal(typeof isVaried('n-bonds-10'), 'boolean')
  assert.ok(IMPLEMENTED.some(isVaried), 'at least some skills should vary')
})
