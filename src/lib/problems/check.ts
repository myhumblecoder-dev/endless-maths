/**
 * Grading. Three outcomes, not two — see docs/design.md.
 *
 * Only the Tier 1 answer kinds are handled here. Fraction, mixed, expression
 * and set answers throw rather than guess: a wrong `false` would mark a child
 * incorrect for a right answer, which is the worst thing this app can do.
 */

import type { Answer, Verdict } from '@/lib/curriculum/types'
import { isSimplified, parseFraction, sameValue, simplify } from './fraction'
import { normalise } from './expression'

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

    // Fractions and mixed numbers grade identically: the same number written
    // either way is the same answer. What differs is whether it is finished.
    case 'fraction':
    case 'mixed': {
      const given = parseFraction(raw)
      if (!given) return 'incorrect'

      const want = expected.kind === 'fraction'
        ? { num: expected.num, den: expected.den }
        : {
            num: (expected.whole < 0 ? -1 : 1) *
                 (Math.abs(expected.whole) * expected.den + expected.num),
            den: expected.den,
          }

      if (!sameValue(given, want)) return 'incorrect'

      // Right value. Lowest terms is the rest of the skill — see
      // docs/design.md, "Simplifying is part of the skill".
      return isSimplified(given.num, given.den) ? 'correct' : 'equivalent-unsimplified'
    }

    /**
     * Collecting like terms happens while parsing, so there is no half-finished
     * state to nudge about — unlike a fraction or a ratio, an expression is
     * either equivalent or it is not.
     */
    case 'expression': {
      const want = normalise(expected.canonical)
      if (!want) {
        // Comparing against an unparseable canonical would return false for
        // every input, including the right one — silently marking correct
        // answers wrong. Fail loudly instead.
        throw new Error(`check(): expected canonical '${expected.canonical}' does not parse`)
      }
      const given = normalise(raw)
      return given === want ? 'correct' : 'incorrect'
    }

    case 'parts': {
      const parts = raw.split(expected.separator).map((s) => s.trim())
      if (parts.length !== expected.parts.length) return 'incorrect'
      if (!parts.every((s) => /^\d+$/.test(s))) return 'incorrect'

      const given = parts.map(Number)
      if (given.every((n, i) => n === expected.parts[i])) return 'correct'

      /**
       * A ratio has a right value in the wrong form, exactly like a fraction —
       * "4 : 6" is 2 : 3 unsimplified. A remainder does not: "14 r 4" is simply
       * a different answer from "7 r 2", even though 14:4 reduces to 7:2.
       */
      if (expected.separator === ':' && given.length === 2) {
        const reduced = simplify(given[0], given[1])
        if (reduced.num === expected.parts[0] && reduced.den === expected.parts[1]) {
          return 'equivalent-unsimplified'
        }
      }

      return 'incorrect'
    }

    /**
     * Every kind is handled, so TypeScript narrows this to `never` — which
     * means adding a new answer kind without a branch here is now a compile
     * error rather than a runtime surprise. The throw stays for anything that
     * reaches here at runtime despite the types, because the cost of guessing
     * is marking a correct answer wrong.
     */
    default: {
      const unhandled: never = expected
      throw new Error(
        `check(): answer kind '${(unhandled as Answer).kind}' not implemented yet`,
      )
    }
  }
}
