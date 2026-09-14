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
