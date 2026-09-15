import { test } from 'vitest'
import assert from 'node:assert/strict'
import { generate, seeded } from './index'
import { check } from './check'
import { isSimplified, parseFraction } from './fraction'

const draws = (skill: Parameters<typeof generate>[0], n = 800) => {
  const rng = seeded(4242)
  return Array.from({ length: n }, () => generate(skill, rng))
}

// ---- f-identify -----------------------------------------------------------

test('naming a fraction always has an answer already in lowest terms', () => {
  // Otherwise the correct answer would grade as equivalent-unsimplified, which
  // would be absurd on the very skill that introduces fractions.
  for (const p of draws('f-identify')) {
    assert.equal(p.answer.kind, 'fraction')
    if (p.answer.kind !== 'fraction') continue
    assert.ok(isSimplified(p.answer.num, p.answer.den), `${p.prompt} -> ${p.answer.num}/${p.answer.den}`)
    assert.ok(p.answer.num < p.answer.den, 'proper fractions only at this level')
    assert.ok(p.answer.den > 1)
  }
})

// ---- f-equivalent ---------------------------------------------------------

/**
 * Asked as a missing numerator, so the answer is a whole number. Asking for
 * "6/8" directly would collide with the simplify-everything policy: the
 * expected answer would itself grade as equivalent-unsimplified.
 */
test('equivalent fractions ask for the missing numerator', () => {
  for (const p of draws('f-equivalent')) {
    assert.equal(p.answer.kind, 'integer')
    assert.match(p.prompt, /\?/, 'something must be missing')
  }
})

test('the missing numerator really does make the fractions equal', () => {
  for (const p of draws('f-equivalent')) {
    const m = p.prompt.match(/^(\d+)\/(\d+) = \?\/(\d+)$/)
    assert.ok(m, `unexpected prompt shape: ${p.prompt}`)
    const [, num, den, target] = m.map(Number)
    assert.ok(p.answer.kind === 'integer')
    // num/den === answer/target
    assert.equal(num * target, p.answer.value * den, `${p.prompt} -> ${p.answer.value}`)
    assert.ok(Number.isInteger(p.answer.value))
  }
})

// ---- f-compare ------------------------------------------------------------

test('comparing fractions is answered with a relation, not a number', () => {
  for (const p of draws('f-compare')) {
    assert.equal(p.answer.kind, 'choice')
    if (p.answer.kind !== 'choice') continue
    assert.deepEqual(p.answer.options, ['<', '=', '>'])
  }
})

test('the stated relation is true', () => {
  for (const p of draws('f-compare')) {
    const m = p.prompt.match(/^(\d+)\/(\d+) \? (\d+)\/(\d+)$/)
    assert.ok(m, `unexpected prompt shape: ${p.prompt}`)
    const [, a, b, c, d] = m.map(Number)
    const expected = a * d < c * b ? '<' : a * d > c * b ? '>' : '='
    assert.ok(p.answer.kind === 'choice')
    assert.equal(p.answer.value, expected, `${p.prompt} claimed ${p.answer.value}`)
  }
})

test('comparisons are not all trivially unequal denominators', () => {
  const shapes = new Set(draws('f-compare').map((p) => {
    const [, , b, , d] = p.prompt.match(/^(\d+)\/(\d+) \? (\d+)\/(\d+)$/)!.map(Number)
    return b === d ? 'same-denominator' : 'different-denominator'
  }))
  assert.equal(shapes.size, 2, 'both same and different denominators should come up')
})

// ---- grading round trip ---------------------------------------------------

test('the answer to every new fraction skill grades correct', () => {
  for (const skill of ['f-identify', 'f-equivalent', 'f-compare'] as const) {
    for (const p of draws(skill, 300)) {
      const typed =
        p.answer.kind === 'fraction' ? `${p.answer.num}/${p.answer.den}`
        : p.answer.kind === 'integer' ? String(p.answer.value)
        : p.answer.kind === 'choice' ? p.answer.value
        : ''
      assert.equal(check(p.answer, typed), 'correct', `${skill}: ${p.prompt} typed "${typed}"`)
    }
  }
})

test('an unsimplified answer to naming a fraction is caught', () => {
  const p = draws('f-identify', 1)[0]
  assert.ok(p.answer.kind === 'fraction')
  const doubled = `${p.answer.num * 2}/${p.answer.den * 2}`
  assert.equal(check(p.answer, doubled), 'equivalent-unsimplified')
  assert.ok(parseFraction(doubled))
})

test('each new skill has enough distinct problems for a session', () => {
  // A session of 20 refuses to repeat a question, so a skill with a thin pool
  // would quietly force repeats. Naming a fraction is the tightest, because the
  // answer must already be in lowest terms.
  for (const skill of ['f-identify', 'f-equivalent', 'f-compare'] as const) {
    const distinct = new Set(draws(skill, 2000).map((p) => p.prompt)).size
    assert.ok(distinct >= 25, `${skill} produces only ${distinct} distinct problems`)
  }
})
