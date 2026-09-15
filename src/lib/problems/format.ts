/** Rendering an answer back to the child. Presentation only — never grading. */

import type { Answer, Verdict } from '@/lib/curriculum/types'

export function formatAnswer(answer: Answer): string {
  switch (answer.kind) {
    case 'integer':
      // A typographic minus, matching how the prompts are written.
      return answer.value < 0 ? `−${Math.abs(answer.value)}` : String(answer.value)
    case 'decimal':
      return answer.value.toFixed(answer.dp)
    case 'choice':
      return answer.value
    case 'fraction': {
      // A denominator of 1 is a whole number; "2/1" is not how anyone writes two.
      const body = answer.den === 1 ? `${Math.abs(answer.num)}` : `${Math.abs(answer.num)}/${answer.den}`
      return answer.num < 0 ? `−${body}` : body
    }
    case 'mixed':
      return `${answer.whole} ${answer.num}/${answer.den}`
    case 'parts':
      return answer.parts.join(` ${answer.separator} `)
    default:
      return ''
  }
}

/**
 * What the learner sees after answering.
 *
 * Flat and factual. The audience is 11-13, and the retrieval-practice research
 * is clear that frequent low-stakes testing should feel like practice rather
 * than constant judgement — so no praise, no commiseration, no exclamation.
 * A wrong answer labels the number, because a bare "8" sitting where their own
 * entry was reads as confusing rather than corrective.
 *
 * The third verdict needs its own words. Saying "Correct" would silently accept
 * an unfinished answer; saying "Answer: 3/4" would tell them they were wrong.
 * Neither is true — see docs/design.md, "Simplifying is part of the skill".
 */
export function feedbackText(verdict: Verdict, expected: string): string {
  switch (verdict) {
    case 'correct':
      return 'Correct'
    case 'equivalent-unsimplified':
      return `Right — now simplify it`
    default:
      return `Answer: ${expected}`
  }
}
