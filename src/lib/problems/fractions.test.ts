import { test } from 'vitest'
import assert from 'node:assert/strict'
import { generate, seeded } from './index'
import { check } from './check'
import { gcd, isSimplified, parseFraction, simplify as simplifyPair } from './fraction'
import { formatAnswer } from './format'

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

// ---- f-add-like / f-sub-like ---------------------------------------------

const likeSkills = ['f-add-like', 'f-sub-like'] as const

test('same-denominator sums and differences are proper and in lowest terms', () => {
  for (const skill of likeSkills) {
    for (const p of draws(skill)) {
      assert.equal(p.answer.kind, 'fraction')
      if (p.answer.kind !== 'fraction') continue
      assert.ok(isSimplified(p.answer.num, p.answer.den),
        `${skill}: ${p.prompt} -> ${p.answer.num}/${p.answer.den} is not in lowest terms`)
      assert.ok(p.answer.num > 0, `${skill}: ${p.prompt} -> not positive`)
      assert.ok(p.answer.num <= p.answer.den, `${skill}: ${p.prompt} -> improper`)
    }
  }
})

test('both fractions in the question share a denominator', () => {
  for (const skill of likeSkills) {
    for (const p of draws(skill)) {
      const m = p.prompt.match(/^(\d+)\/(\d+) [+−] (\d+)\/(\d+)$/)
      assert.ok(m, `${skill}: unexpected prompt shape "${p.prompt}"`)
      assert.equal(m[2], m[4], `${skill}: "${p.prompt}" is not a same-denominator question`)
    }
  }
})

test('the stated answer is arithmetically right', () => {
  for (const skill of likeSkills) {
    for (const p of draws(skill)) {
      const [, a, d, b] = p.prompt.match(/^(\d+)\/(\d+) [+−] (\d+)\/(\d+)$/)!.map(Number)
      const raw = p.prompt.includes('+') ? a + b : a - b
      assert.ok(p.answer.kind === 'fraction')
      // Compare by cross-multiplication: the answer is simplified, the raw sum is not.
      assert.equal(raw * p.answer.den, p.answer.num * d, `${skill}: ${p.prompt}`)
    }
  }
})

test('subtraction never goes negative at this level', () => {
  for (const p of draws('f-sub-like')) {
    const [, a, , b] = p.prompt.match(/^(\d+)\/(\d+) − (\d+)\/(\d+)$/)!.map(Number)
    assert.ok(a > b, `${p.prompt} would be negative`)
  }
})

/**
 * The point of the policy: a learner who works out 3/6 and stops has done the
 * arithmetic but not the skill. A run of questions that never needs simplifying
 * would never exercise that.
 */
test('a good share of answers genuinely need simplifying', () => {
  for (const skill of likeSkills) {
    const problems = draws(skill)
    const needsWork = problems.filter((p) => {
      const [, a, d, b] = p.prompt.match(/^(\d+)\/(\d+) [+−] (\d+)\/(\d+)$/)!.map(Number)
      const raw = p.prompt.includes('+') ? a + b : a - b
      return !isSimplified(raw, d)
    })
    const share = needsWork.length / problems.length
    assert.ok(share > 0.2, `${skill}: only ${(share * 100).toFixed(0)}% need simplifying`)
  }
})

test('the like-denominator skills have enough distinct problems', () => {
  for (const skill of likeSkills) {
    const distinct = new Set(draws(skill, 2000).map((p) => p.prompt)).size
    assert.ok(distinct >= 25, `${skill} produces only ${distinct} distinct problems`)
  }
})

// ---- f-add-unlike ---------------------------------------------------------

test('unlike denominators really are unlike', () => {
  for (const p of draws('f-add-unlike')) {
    const m = p.prompt.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+)$/)
    assert.ok(m, `unexpected prompt shape "${p.prompt}"`)
    assert.notEqual(m[2], m[4], `"${p.prompt}" is a same-denominator question`)
  }
})

test('the common denominator stays small enough to do mentally', () => {
  for (const p of draws('f-add-unlike')) {
    const [, , d1, , d2] = p.prompt.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+)$/)!.map(Number)
    const lcm = (d1 * d2) / gcd(d1, d2)
    assert.ok(lcm <= 24, `${p.prompt} needs a common denominator of ${lcm}`)
  }
})

test('unlike sums are proper, positive and in lowest terms', () => {
  for (const p of draws('f-add-unlike')) {
    assert.ok(p.answer.kind === 'fraction')
    if (p.answer.kind !== 'fraction') continue
    assert.ok(isSimplified(p.answer.num, p.answer.den), `${p.prompt} -> not in lowest terms`)
    assert.ok(p.answer.num > 0)
    assert.ok(p.answer.num <= p.answer.den, `${p.prompt} -> improper`)
  }
})

test('the stated unlike sum is arithmetically right', () => {
  for (const p of draws('f-add-unlike')) {
    const [, a, d1, b, d2] = p.prompt.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+)$/)!.map(Number)
    assert.ok(p.answer.kind === 'fraction')
    // (a*d2 + b*d1)/(d1*d2) === answer, by cross-multiplication
    assert.equal((a * d2 + b * d1) * p.answer.den, p.answer.num * (d1 * d2), p.prompt)
  }
})

/**
 * The classic misconception at this level is adding across — 1/2 + 1/3 = 2/5.
 * A learner who does that must be marked wrong, not nudged to simplify.
 */
test('adding across the top and bottom is wrong, not merely unsimplified', () => {
  for (const p of draws('f-add-unlike', 200)) {
    const [, a, d1, b, d2] = p.prompt.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+)$/)!.map(Number)
    const verdict = check(p.answer, `${a + b}/${d1 + d2}`)
    assert.equal(verdict, 'incorrect', `${p.prompt}: adding across returned "${verdict}"`)
  }
})

test('adding unlike fractions has enough distinct problems', () => {
  const distinct = new Set(draws('f-add-unlike', 2000).map((p) => p.prompt)).size
  assert.ok(distinct >= 25, `only ${distinct} distinct problems`)
})

/**
 * A question like "3/12 + 3/6" is odd: a teacher would simplify the addends
 * before adding, so posing them unsimplified teaches the wrong first move. The
 * same-denominator skills are different — "3/6 + 1/6" is entirely normal there,
 * because keeping the denominator is the point.
 */
test('unlike questions pose their addends in lowest terms', () => {
  for (const p of draws('f-add-unlike')) {
    const [, a, d1, b, d2] = p.prompt.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+)$/)!.map(Number)
    assert.ok(isSimplified(a, d1), `${p.prompt}: ${a}/${d1} should be simplified`)
    assert.ok(isSimplified(b, d2), `${p.prompt}: ${b}/${d2} should be simplified`)
  }
})

// ---- f-multiply / f-divide ------------------------------------------------

const opSkills = ['f-multiply', 'f-divide'] as const

test('multiplying and dividing pose simplified fractions and answer in lowest terms', () => {
  for (const skill of opSkills) {
    for (const p of draws(skill)) {
      const [, a, d1, b, d2] = p.prompt.match(/^(\d+)\/(\d+) [×÷] (\d+)\/(\d+)$/)!.map(Number)
      assert.ok(isSimplified(a, d1), `${skill}: ${p.prompt} poses ${a}/${d1}`)
      assert.ok(isSimplified(b, d2), `${skill}: ${p.prompt} poses ${b}/${d2}`)
      assert.ok(p.answer.kind === 'fraction')
      if (p.answer.kind !== 'fraction') continue
      assert.ok(isSimplified(p.answer.num, p.answer.den), `${skill}: ${p.prompt} -> not in lowest terms`)
      assert.ok(p.answer.num > 0)
    }
  }
})

test('the stated product is right', () => {
  for (const p of draws('f-multiply')) {
    const [, a, d1, b, d2] = p.prompt.match(/^(\d+)\/(\d+) × (\d+)\/(\d+)$/)!.map(Number)
    assert.ok(p.answer.kind === 'fraction')
    assert.equal(a * b * p.answer.den, p.answer.num * (d1 * d2), p.prompt)
  }
})

test('the stated quotient is right', () => {
  for (const p of draws('f-divide')) {
    const [, a, d1, b, d2] = p.prompt.match(/^(\d+)\/(\d+) ÷ (\d+)\/(\d+)$/)!.map(Number)
    assert.ok(p.answer.kind === 'fraction')
    // a/d1 ÷ b/d2 === (a*d2)/(d1*b)
    assert.equal(a * d2 * p.answer.den, p.answer.num * (d1 * b), p.prompt)
  }
})

/** Multiplying denominators instead of cross-multiplying is the division slip. */
test('forgetting to flip the divisor grades incorrect', () => {
  for (const p of draws('f-divide', 200)) {
    const [, a, d1, b, d2] = p.prompt.match(/^(\d+)\/(\d+) ÷ (\d+)\/(\d+)$/)!.map(Number)
    if (a * b === 0) continue
    const slip = simplifyPair(a * b, d1 * d2)
    assert.ok(p.answer.kind === 'fraction')
    // Only meaningful when the slip differs from the right answer.
    if (slip.num === p.answer.num && slip.den === p.answer.den) continue
    assert.equal(check(p.answer, `${slip.num}/${slip.den}`), 'incorrect', p.prompt)
  }
})

test('a whole-number answer is shown as a whole number', () => {
  // "2/1" is not how anyone writes two.
  assert.equal(formatAnswer({ kind: 'fraction', num: 2, den: 1 }), '2')
  assert.equal(check({ kind: 'fraction', num: 2, den: 1 }, '2'), 'correct')
})

test('multiplying and dividing have enough distinct problems', () => {
  for (const skill of opSkills) {
    const distinct = new Set(draws(skill, 2000).map((p) => p.prompt)).size
    assert.ok(distinct >= 25, `${skill} produces only ${distinct} distinct problems`)
  }
})

// ---- f-convert-fdp --------------------------------------------------------

test('converting covers all four directions', () => {
  /** Direction is the pair (what is given, what is asked for). */
  const direction = (prompt: string) => {
    const given = /%/.test(prompt) ? 'percent' : /\d\.\d/.test(prompt) ? 'decimal' : 'fraction'
    const wanted = prompt.match(/as a (\w+)/)![1]
    return `${given}->${wanted}`
  }
  const seen = new Set(draws('f-convert-fdp').map((p) => direction(p.prompt)))
  assert.deepEqual(
    [...seen].sort(),
    ['decimal->fraction', 'fraction->decimal', 'fraction->percentage', 'percent->fraction'],
  )
})

test('every conversion terminates exactly', () => {
  for (const p of draws('f-convert-fdp')) {
    if (p.answer.kind === 'decimal') {
      const scaled = p.answer.value * 10 ** p.answer.dp
      assert.ok(Math.abs(scaled - Math.round(scaled)) < 1e-9, `${p.prompt} -> ${p.answer.value} is not exact`)
    }
    if (p.answer.kind === 'integer') {
      assert.ok(Number.isInteger(p.answer.value), `${p.prompt} -> ${p.answer.value} is not whole`)
    }
    if (p.answer.kind === 'fraction') {
      assert.ok(isSimplified(p.answer.num, p.answer.den), `${p.prompt} -> not in lowest terms`)
    }
  }
})

test('the conversion is arithmetically right', () => {
  for (const p of draws('f-convert-fdp')) {
    const [num, den] = p.operands
    if (p.answer.kind === 'decimal') {
      assert.ok(Math.abs(p.answer.value - num / den) < 1e-9, `${p.prompt} -> ${p.answer.value}`)
    } else if (p.answer.kind === 'integer') {
      assert.equal(p.answer.value, (num * 100) / den, p.prompt)
    } else if (p.answer.kind === 'fraction') {
      assert.equal(p.answer.num * den, num * p.answer.den, p.prompt)
    }
  }
})

test('each conversion answer grades correct as typed', () => {
  for (const p of draws('f-convert-fdp', 400)) {
    const typed =
      p.answer.kind === 'decimal' ? String(p.answer.value)
      : p.answer.kind === 'integer' ? String(p.answer.value)
      : p.answer.kind === 'fraction' ? `${p.answer.num}/${p.answer.den}`
      : ''
    assert.equal(check(p.answer, typed), 'correct', `${p.prompt} typed "${typed}"`)
  }
})

test('a skill may declare more than one answer kind', () => {
  // f-convert-fdp genuinely has several: "as a decimal" gives a decimal, "as a
  // percentage" a whole number, "as a fraction" a fraction.
  const kinds = new Set(draws('f-convert-fdp').map((p) => p.answer.kind))
  assert.ok(kinds.size >= 3, `expected several answer kinds, saw ${[...kinds].join(', ')}`)
})

test('decimals are written the way a person writes them', () => {
  // "0.20" and "0.50" are not wrong, but nobody writes them. Trailing zeros in
  // a prompt also hint at the answer's shape, which is its own small problem.
  for (const p of draws('f-convert-fdp')) {
    const shown = p.prompt.match(/([\d]+\.[\d]+)/)?.[1]
    if (shown) assert.doesNotMatch(shown, /0$/, `prompt shows "${shown}"`)
    if (p.answer.kind === 'decimal') {
      assert.doesNotMatch(formatAnswer(p.answer), /\.\d*0$/, `answer shows "${formatAnswer(p.answer)}"`)
    }
  }
})
