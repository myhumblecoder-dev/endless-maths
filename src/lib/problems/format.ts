/** Rendering an answer back to the child. Presentation only — never grading. */

import type { Answer } from '@/lib/curriculum/types'

export function formatAnswer(answer: Answer): string {
  switch (answer.kind) {
    case 'integer':
      // A typographic minus, matching how the prompts are written.
      return answer.value < 0 ? `−${Math.abs(answer.value)}` : String(answer.value)
    case 'decimal':
      return answer.value.toFixed(answer.dp)
    case 'choice':
      return answer.value
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
 */
export function feedbackText(correct: boolean, expected: string): string {
  return correct ? 'Correct' : `Answer: ${expected}`
}
