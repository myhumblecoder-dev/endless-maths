import { test } from 'vitest'
import assert from 'node:assert/strict'
import { IMPLEMENTED, generate, seeded } from './index'
import { check } from './check'
import { canSubmit, press } from '@/lib/session/keypad'
import type { Answer } from '@/lib/curriculum/types'

/** Build an entry the way the keypad actually does: one press at a time. */
function typeIn(text: string): string {
  let entry = ''
  for (const ch of text) entry = press(entry, ch === '-' || ch === '−' ? '-' : ch)
  return entry
}

/** Answer kinds the keypad can produce character by character. */
const TYPEABLE = new Set(['integer', 'decimal', 'fraction'])

/** Every spelling a person might reasonably produce for this answer. */
function spellings(a: Answer): string[] {
  switch (a.kind) {
    case 'integer':
      return [String(a.value)]
    case 'decimal':
      // A person types 2.1, not 2.10 — trailing zeros are not how anyone writes.
      return [a.value.toFixed(a.dp), String(a.value)]
    case 'choice':
      return [a.value]
    case 'fraction':
      return [`${a.num}/${a.den}`]
    case 'mixed':
      // Both forms are the same answer; a learner may type either.
      return [`${a.whole} ${a.num}/${a.den}`, `${a.whole * a.den + a.num}/${a.den}`]
    default:
      return []
  }
}

test('every answer a person can type is graded correct', () => {
  const rng = seeded(20260914)
  const failures: string[] = []

  for (const skill of IMPLEMENTED) {
    for (let i = 0; i < 400; i++) {
      const p = generate(skill, rng)
      for (const text of spellings(p.answer)) {
        if (!TYPEABLE.has(p.answer.kind)) {
          // Choice and mixed answers are not typed key by key.
          if (check(p.answer, text) !== 'correct') failures.push(`${skill}: "${p.prompt}" -> "${text}"`)
          continue
        }
        const entry = typeIn(text)
        if (entry !== text) {
          failures.push(`${skill}: "${p.prompt}" typing "${text}" produced "${entry}"`)
          continue
        }
        if (!canSubmit(entry)) {
          failures.push(`${skill}: "${p.prompt}" cannot submit "${entry}"`)
          continue
        }
        if (check(p.answer, entry) !== 'correct') {
          failures.push(`${skill}: "${p.prompt}" typed "${entry}" graded WRONG`)
        }
      }
    }
  }

  assert.deepEqual(failures.slice(0, 15), [], `${failures.length} typed answers misgraded`)
})

test('the keypad can physically produce every answer', () => {
  const failures: string[] = []
  const rng = seeded(7)
  for (const skill of IMPLEMENTED) {
    for (let i = 0; i < 300; i++) {
      const p = generate(skill, rng)
      if (p.answer.kind === 'choice') continue
      const a = p.answer
      if (a.kind !== 'integer' && a.kind !== 'decimal' && a.kind !== 'fraction') continue
      const text = a.kind === 'decimal' ? a.value.toFixed(a.dp)
        : a.kind === 'fraction' ? `${a.num}/${a.den}`
        : String(a.value)
      // Keys the keypad offers for this answer kind.
      const keys = new Set([
        '0','1','2','3','4','5','6','7','8','9','back',
        a.kind === 'decimal' ? '.' : a.kind === 'fraction' ? '/' : '-',
      ])
      for (const ch of text) {
        const key = ch === '-' || ch === '−' ? '-' : ch
        if (!keys.has(key)) failures.push(`${skill}: "${p.prompt}" needs key "${key}" which the keypad does not show`)
      }
    }
  }
  assert.deepEqual([...new Set(failures)].slice(0, 15), [], `${failures.length} unreachable answers`)
})
