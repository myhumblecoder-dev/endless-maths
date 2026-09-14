/**
 * Grading. Three outcomes, not two — see docs/design.md.
 *
 * Only the Tier 1 answer kinds are handled here. Fraction, mixed, expression
 * and set answers throw rather than guess: a wrong `false` would mark a child
 * incorrect for a right answer, which is the worst thing this app can do.
 */

import type { Answer, Verdict } from '@/lib/curriculum/types'

export function check(expected: Answer, given: string): Verdict {
  const raw = given.trim()
  if (raw === '') return 'incorrect'

  switch (expected.kind) {
    case 'integer': {
      // Accept the child's minus sign in either the ASCII or typographic form.
      const n = Number(raw.replace('−', '-'))
      return Number.isInteger(n) && n === expected.value ? 'correct' : 'incorrect'
    }

    case 'decimal': {
      const n = Number(raw.replace('−', '-'))
      if (!Number.isFinite(n)) return 'incorrect'
      // Compare as scaled integers: 0.1 + 0.2 !== 0.3 in floating point.
      const scale = 10 ** expected.dp
      return Math.round(n * scale) === Math.round(expected.value * scale) ? 'correct' : 'incorrect'
    }

    case 'choice':
      return raw.toLowerCase() === expected.value.toLowerCase() ? 'correct' : 'incorrect'

    default:
      throw new Error(`check(): answer kind '${expected.kind}' not implemented yet`)
  }
}
