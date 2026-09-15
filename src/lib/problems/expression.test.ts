import { test } from 'vitest'
import assert from 'node:assert/strict'
import { linear, normalise } from './expression'
import { check } from './check'
import type { Answer } from '@/lib/curriculum/types'
import { generate, seeded } from './index'

const expr = (canonical: string): Answer => ({ kind: 'expression', canonical })

// ---- normalising ----------------------------------------------------------

test('terms are ordered, so the same expression written either way agrees', () => {
  assert.equal(normalise('3+5x'), normalise('5x+3'))
  assert.equal(normalise('5x + 3'), normalise('3 + 5x'))
})

test('like terms are collected on the way in', () => {
  assert.equal(normalise('x+x'), normalise('2x'))
  assert.equal(normalise('3x+2x'), normalise('5x'))
  assert.equal(normalise('4+1'), normalise('5'))
  assert.equal(normalise('7x-2x+3'), normalise('5x+3'))
})

test('an implicit coefficient of one is the same as writing it', () => {
  assert.equal(normalise('x'), normalise('1x'))
  assert.equal(normalise('-x'), normalise('-1x'))
  assert.equal(normalise('x+4'), normalise('1x+4'))
})

test('a typographic minus is the same as a hyphen', () => {
  assert.equal(normalise('5x − 3'), normalise('5x-3'))
})

test('genuinely different expressions do not agree', () => {
  assert.notEqual(normalise('5x+3'), normalise('5x+4'))
  assert.notEqual(normalise('5x+3'), normalise('3x+5'))
  assert.notEqual(normalise('5x'), normalise('-5x'))
})

test('a vanishing term is dropped', () => {
  assert.equal(normalise('3x-3x+7'), normalise('7'))
  assert.equal(normalise('2x+0'), normalise('2x'))
})

test('nonsense does not normalise', () => {
  for (const bad of ['', '  ', 'hello', 'x+', '+', '3x+', '**', 'y+1']) {
    assert.equal(normalise(bad), undefined, `"${bad}" should not normalise`)
  }
})

test('inequalities compare relation and value together', () => {
  assert.equal(normalise('x>5'), normalise('x > 5'))
  assert.notEqual(normalise('x>5'), normalise('x<5'))
  assert.notEqual(normalise('x>5'), normalise('x>6'))
  assert.equal(normalise('x >= 5'), normalise('x≥5'))
})

// ---- grading --------------------------------------------------------------

test('an expression answer accepts any equivalent spelling', () => {
  assert.equal(check(expr('5x+3'), '3+5x'), 'correct')
  assert.equal(check(expr('5x+3'), '5x + 3'), 'correct')
  assert.equal(check(expr('5x+3'), '2x+3x+3'), 'correct')
})

test('a wrong expression is incorrect, and unparseable input does not crash', () => {
  assert.equal(check(expr('5x+3'), '5x+4'), 'incorrect')
  for (const bad of ['', 'abc', 'x+', '???']) {
    assert.equal(check(expr('5x+3'), bad), 'incorrect', `"${bad}"`)
  }
})

test('expressions have no notion of being unsimplified', () => {
  // Collecting terms happens on the way in, so there is no half-finished state
  // to nudge about — unlike a fraction or a ratio.
  assert.notEqual(check(expr('5x+3'), '2x+3x+3'), 'equivalent-unsimplified')
})

// ---- p-like-terms / p-distribute ------------------------------------------

const draws = (skill: 'p-like-terms' | 'p-distribute', n = 800) => {
  const rng = seeded(515)
  return Array.from({ length: n }, () => generate(skill, rng))
}

test('collecting like terms is answered with an expression', () => {
  for (const p of draws('p-like-terms')) {
    assert.equal(p.answer.kind, 'expression')
    assert.ok(p.answer.kind === 'expression' && normalise(p.answer.canonical))
  }
})

test('the collected form really is equivalent to the question', () => {
  for (const p of draws('p-like-terms')) {
    assert.ok(p.answer.kind === 'expression')
    if (p.answer.kind !== 'expression') continue
    // The prompt is itself a linear expression, so normalising it must agree.
    assert.equal(normalise(p.prompt), normalise(p.answer.canonical), p.prompt)
  }
})

test('collecting has something to collect', () => {
  for (const p of draws('p-like-terms')) {
    assert.notEqual(normalise(p.prompt), p.prompt.replace(/\s/g, ''),
      `"${p.prompt}" is already collected — nothing to do`)
  }
})

test('expanding brackets is equivalent to the expanded form', () => {
  for (const p of draws('p-distribute')) {
    const m = p.prompt.match(/^([−-]?\d*)\((-?\d*x?)\s*([+−-])\s*(\d+)\)$/)
    assert.ok(m, `unexpected prompt shape "${p.prompt}"`)
    const outside = Number(m[1].replace('−', '-')) || (m[1].startsWith('−') || m[1].startsWith('-') ? -1 : 1)
    const inner = m[2] === 'x' ? 1 : Number(m[2].replace('x', '')) || 1
    const constant = (m[3] === '-' || m[3] === '−' ? -1 : 1) * Number(m[4])
    assert.ok(p.answer.kind === 'expression')
    if (p.answer.kind !== 'expression') continue
    // Built with `linear`, not by joining strings: "18x" + "+" + "-6" gives
    // "18x+-6", which is not an expression and normalises to undefined.
    assert.equal(normalise(p.answer.canonical), linear(outside * inner, outside * constant), p.prompt)
  }
})

/** Negative multipliers are where the sign slip lives, so they must come up. */
test('expanding includes negative multipliers', () => {
  const negatives = draws('p-distribute').filter((p) => p.prompt.startsWith('−'))
  assert.ok(negatives.length > 0, 'a negative multiplier never came up')
})

test('leaving the brackets unexpanded is not an answer', () => {
  for (const p of draws('p-distribute', 200)) {
    assert.equal(check(p.answer, p.prompt), 'incorrect',
      `"${p.prompt}" restated should not be accepted — expanding is the skill`)
  }
})

test('the expression skills have enough distinct problems', () => {
  for (const skill of ['p-like-terms', 'p-distribute'] as const) {
    const distinct = new Set(draws(skill, 2000).map((p) => p.prompt)).size
    assert.ok(distinct >= 25, `${skill} produces only ${distinct} distinct problems`)
  }
})

test('a negative multiplier is written with a real minus sign', () => {
  for (const p of draws('p-distribute')) {
    assert.doesNotMatch(p.prompt, /^-\d/, `"${p.prompt}" uses a hyphen, not a minus`)
  }
})

// ---- p-inequalities -------------------------------------------------------

const inequalities = (n = 800) => {
  const rng = seeded(1818)
  return Array.from({ length: n }, () => generate('p-inequalities', rng))
}

test('an inequality is answered with a range, not a number', () => {
  for (const p of inequalities()) {
    assert.ok(p.answer.kind === 'expression')
    if (p.answer.kind !== 'expression') continue
    assert.match(p.answer.canonical, /^x(<=|>=|<|>)-?\d+$/, p.answer.canonical)
    assert.equal(check(p.answer, String(p.operands[2])), 'incorrect',
      `${p.prompt}: the boundary alone is not the answer`)
  }
})

test('the stated range actually solves the inequality', () => {
  for (const p of inequalities()) {
    const [a, b] = p.operands
    assert.ok(p.answer.kind === 'expression')
    if (p.answer.kind !== 'expression') continue
    const [, answerRelation, boundaryText] = p.answer.canonical.match(/^x(<=|>=|<|>)(-?\d+)$/)!
    const boundary = Number(boundaryText)
    // The ORIGINAL inequality is what a value must satisfy — not the answer's
    // relation, which may have been flipped on the way.
    // Prompts use the proper symbols, so map them back to compare.
    const promptSymbol = p.prompt.match(/([≤≥<>])/)![1]
    const promptRelation = promptSymbol === '≤' ? '<=' : promptSymbol === '≥' ? '>=' : promptSymbol
    const c = Number(p.prompt.trim().split(' ').pop()!.replace('−', '-'))

    const inside = answerRelation.startsWith('<') ? boundary - 1 : boundary + 1
    const lhs = a * inside + b
    const holds =
      promptRelation === '<' ? lhs < c
      : promptRelation === '>' ? lhs > c
      : promptRelation === '<=' ? lhs <= c
      : lhs >= c
    assert.ok(holds,
      `${p.prompt} -> ${p.answer.canonical}: x=${inside} gives ${lhs}, which fails ${promptRelation} ${c}`)
  }
})

/**
 * The classic Year 8 misconception: multiplying or dividing by a negative flips
 * the inequality. A run of positive coefficients would never meet it.
 */
test('negative coefficients come up, and the sign flips when they do', () => {
  const negatives = inequalities().filter((p) => p.operands[0] < 0)
  assert.ok(negatives.length > 50, `only ${negatives.length} negative coefficients in 800`)

  for (const p of negatives) {
    assert.ok(p.answer.kind === 'expression')
    if (p.answer.kind !== 'expression') continue
    const promptSymbol = p.prompt.match(/([≤≥<>])/)![1]
    const promptDirection = promptSymbol === '≤' || promptSymbol === '<' ? '<' : '>'
    const answerDirection = p.answer.canonical.includes('<') ? '<' : '>'
    assert.notEqual(answerDirection, promptDirection,
      `${p.prompt} -> ${p.answer.canonical}: the sign should have flipped`)
  }
})

test('forgetting to flip the sign is marked wrong', () => {
  for (const p of inequalities(200).filter((q) => q.operands[0] < 0)) {
    assert.ok(p.answer.kind === 'expression')
    if (p.answer.kind !== 'expression') continue
    const unflipped = p.answer.canonical
      .replace('<=', '§').replace('>=', '<=').replace('§', '>=')
      .replace(/(?<![<>])<(?!=)/, '§').replace(/(?<![<>])>(?!=)/, '<').replace('§', '>')
    if (unflipped === p.answer.canonical) continue
    assert.equal(check(p.answer, unflipped), 'incorrect', `${p.prompt}: ${unflipped} accepted`)
  }
})

test('inequalities have enough distinct problems', () => {
  const distinct = new Set(inequalities(2000).map((p) => p.prompt)).size
  assert.ok(distinct >= 25, `only ${distinct} distinct problems`)
})

test('inequality prompts use proper symbols throughout', () => {
  for (const p of inequalities()) {
    assert.doesNotMatch(p.prompt, /<=|>=/, `"${p.prompt}" should use ≤ or ≥`)
    assert.doesNotMatch(p.prompt, / -\d/, `"${p.prompt}" should use a typographic minus`)
  }
})
