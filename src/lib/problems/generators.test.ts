import { test } from 'vitest'
import assert from 'node:assert/strict'
import { GENERATORS, IMPLEMENTED, generate, seeded } from './index'
import { check } from './check'
import { SKILL_BY_ID } from '../curriculum/skills'
import type { ImplementedSkill } from './index'

const N = 2000
const rng = seeded(20260914)

/** Every implemented skill, N draws each. */
function sample(skill: ImplementedSkill, n = N) {
  return Array.from({ length: n }, () => generate(skill, rng))
}

test('every implemented skill exists in the curriculum graph', () => {
  for (const skill of IMPLEMENTED) {
    assert.ok(SKILL_BY_ID.get(skill), `${skill} is generated but not in skills.ts`)
  }
})

test('produced answer kind matches the kind declared in skills.ts', () => {
  for (const skill of IMPLEMENTED) {
    const declared = SKILL_BY_ID.get(skill)!.answerKind
    for (const p of sample(skill, 200)) {
      assert.equal(p.answer.kind, declared, `${skill}: declared ${declared}, produced ${p.answer.kind}`)
    }
  }
})

test('integer answers are always integers', () => {
  for (const skill of IMPLEMENTED) {
    for (const p of sample(skill, 500)) {
      if (p.answer.kind === 'integer') {
        assert.ok(Number.isInteger(p.answer.value), `${skill}: ${p.prompt} -> ${p.answer.value}`)
      }
    }
  }
})

test('decimal answers carry no floating-point residue', () => {
  for (const skill of IMPLEMENTED) {
    for (const p of sample(skill, 500)) {
      if (p.answer.kind === 'decimal') {
        const scaled = p.answer.value * 10 ** p.answer.dp
        assert.ok(
          Math.abs(scaled - Math.round(scaled)) < 1e-9,
          `${skill}: ${p.prompt} -> ${p.answer.value} is not exact to ${p.answer.dp}dp`,
        )
      }
    }
  }
})

test('the correct answer always grades as correct', () => {
  for (const skill of IMPLEMENTED) {
    for (const p of sample(skill, 300)) {
      const typed =
        p.answer.kind === 'integer' ? String(p.answer.value)
        : p.answer.kind === 'decimal' ? p.answer.value.toFixed(p.answer.dp)
        : p.answer.kind === 'choice' ? p.answer.value
        : null
      assert.ok(typed !== null, `${skill}: unhandled answer kind ${p.answer.kind}`)
      assert.equal(check(p.answer, typed), 'correct', `${skill}: ${p.prompt} -> "${typed}" graded wrong`)
    }
  }
})

test('same seed produces the same problems', () => {
  for (const skill of IMPLEMENTED) {
    const a = Array.from({ length: 50 }, (_, i) => generate(skill, seeded(7000 + i)))
    const b = Array.from({ length: 50 }, (_, i) => generate(skill, seeded(7000 + i)))
    assert.deepEqual(a, b, `${skill} is not reproducible from its seed`)
  }
})

test('prompts are rendered the way a person writes them', () => {
  for (const skill of IMPLEMENTED) {
    for (const p of sample(skill, 500)) {
      assert.ok(!/\b1x\b/.test(p.prompt), `${skill}: "1x" should render as "x" — ${p.prompt}`)
      assert.ok(!/[+−-]\s*-/.test(p.prompt), `${skill}: double sign — ${p.prompt}`)
      assert.ok(p.prompt.trim().length > 0, `${skill}: empty prompt`)
    }
  }
})

test('facts carry a factKey, procedures do not', () => {
  for (const skill of IMPLEMENTED) {
    const kind = SKILL_BY_ID.get(skill)!.kind
    for (const p of sample(skill, 100)) {
      if (kind === 'fact') assert.ok(p.factKey, `${skill} is a fact but produced no factKey`)
      else assert.equal(p.factKey, undefined, `${skill} is a procedure but produced factKey ${p.factKey}`)
    }
  }
})

// ---- skill-specific constraints ------------------------------------------
// These are the ones that would silently teach the wrong thing if they broke.

test('two-digit addition splits carrying from non-carrying', () => {
  for (const p of sample('a-add-2digit')) {
    const [a, b] = p.operands
    assert.ok((a % 10) + (b % 10) < 10, `a-add-2digit should not carry: ${p.prompt}`)
  }
  for (const p of sample('a-add-2digit-regroup')) {
    const [a, b] = p.operands
    assert.ok((a % 10) + (b % 10) >= 10, `a-add-2digit-regroup must carry: ${p.prompt}`)
  }
})

test('two-digit subtraction splits borrowing from non-borrowing', () => {
  for (const p of sample('a-sub-2digit')) {
    const [a, b] = p.operands
    assert.ok(a % 10 >= b % 10, `a-sub-2digit should not borrow: ${p.prompt}`)
  }
  for (const p of sample('a-sub-2digit-regroup')) {
    const [a, b] = p.operands
    assert.ok(a % 10 < b % 10, `a-sub-2digit-regroup must borrow: ${p.prompt}`)
  }
})

test('subtraction never goes negative before negatives are taught', () => {
  for (const skill of ['a-sub-within-10', 'a-sub-within-20', 'a-sub-2digit', 'a-sub-2digit-regroup', 'a-sub-3digit'] as const) {
    for (const p of sample(skill, 500)) {
      assert.ok(p.answer.kind === 'integer' && p.answer.value > 0, `${skill}: ${p.prompt} -> negative`)
    }
  }
})

test('division is always exact', () => {
  for (const skill of ['m-div-2-5-10', 'm-div-3-4', 'm-div-6-7-8-9', 'm-long-div'] as const) {
    for (const p of sample(skill, 500)) {
      const [dividend, divisor] = p.operands
      assert.equal(dividend % divisor, 0, `${skill}: ${p.prompt} has a remainder`)
    }
  }
})

test('rounding never asks an ambiguous half case', () => {
  for (const p of sample('n-round')) {
    const [n, to] = p.operands
    assert.notEqual(n % to, to / 2, `n-round: ${p.prompt} is ambiguous`)
  }
})

test('primality answers are true', () => {
  const isPrime = (n: number) => {
    if (n < 2) return false
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
    return true
  }
  for (const p of sample('r-primes')) {
    assert.ok(p.answer.kind === 'choice')
    assert.equal(p.answer.value === 'yes', isPrime(p.operands[0]), `r-primes: ${p.prompt}`)
  }
})

test('equations solve to the stated answer', () => {
  for (const p of sample('p-solve-two-step')) {
    const [a, b, x] = p.operands
    assert.ok(p.answer.kind === 'integer' && p.answer.value === x)
    assert.ok(p.prompt.includes(`= ${a * x + b}`), `p-solve-two-step: ${p.prompt} does not balance`)
  }
  for (const p of sample('p-solve-both-sides')) {
    const [a1, b1, a2, b2] = p.operands
    assert.ok(p.answer.kind === 'integer')
    const x = p.answer.value
    assert.equal(a1 * x + b1, a2 * x + b2, `p-solve-both-sides: ${p.prompt} does not balance`)
    assert.ok(a1 !== a2, `p-solve-both-sides: ${p.prompt} has no unique solution`)
  }
})

test('every generator is covered by a draw', () => {
  assert.equal(IMPLEMENTED.length, Object.keys(GENERATORS).length)
  assert.ok(IMPLEMENTED.length >= 37, `expected the full Tier 1 spine, got ${IMPLEMENTED.length}`)
})
