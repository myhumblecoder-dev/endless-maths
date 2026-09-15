/**
 * What the learner has typed so far, and what a key press does to it.
 *
 * Every function here takes the expected `Answer`, because the rules genuinely
 * differ by kind and a context-free version is dangerous: `x` is the unknown in
 * an expression and meaningless in a times-tables answer, and a minus after a
 * digit is an operator in one and a stranded keystroke in the other.
 *
 * That was not hypothetical. Before the answer was passed in, a child could
 * type `56` for `7 × 8`, press `x` for "times", and submit `"56x"` — graded
 * incorrect for a correct answer, which is the one failure this app cannot
 * afford.
 */

import type { Answer } from '@/lib/curriculum/types'
import { normalise } from '@/lib/problems/expression'

export type Entry = string

export type Key =
  | 'back' | 'clear' | '-' | '+' | '.' | '/' | 'r' | ':' | 'x' | '<' | '>' | string

/** Ten characters is more than any answer we ask for needs. */
const MAX_LENGTH = 10

const isExpression = (answer: Answer) => answer.kind === 'expression'
const isFraction = (answer: Answer) => answer.kind === 'fraction' || answer.kind === 'mixed'
const separatorFor = (answer: Answer) => (answer.kind === 'parts' ? answer.separator : undefined)

/**
 * Is a relation part of this answer? Only inequalities want `<` and `>`; on any
 * other expression a stray one makes the entry unparseable and silently
 * disables Check, with nothing on screen to explain why.
 */
const wantsRelation = (answer: Answer) =>
  answer.kind === 'expression' && /[<>]/.test(answer.canonical)

/** Does this key contribute to an answer of this kind? */
export function isEntryKey(key: string, answer: Answer): boolean {
  if (answer.kind === 'choice') return false
  if (/^[0-9]$/.test(key)) return true

  switch (key) {
    case '-':
      // A sign for anything numeric; also an operator in an expression.
      return answer.kind !== 'parts' && !isFraction(answer)
    case '.':
      return answer.kind === 'decimal'
    case '/':
      return isFraction(answer)
    case 'r':
    case ':':
      return separatorFor(answer) === key
    case 'x':
    case '+':
      return isExpression(answer)
    case '<':
    case '>':
      return wantsRelation(answer)
    default:
      return false
  }
}

export function press(entry: Entry, key: Key, answer: Answer): Entry {
  if (key === 'back') return entry.slice(0, -1)
  if (key === 'clear') return ''

  // A key that means nothing for this answer changes nothing.
  if (!isEntryKey(key, answer)) return entry
  if (entry.length >= MAX_LENGTH) return entry

  switch (key) {
    /**
     * At the front it is a sign. After a term it is an operator, which only
     * makes sense in an expression — elsewhere it would strand the entry in a
     * state that cannot be submitted.
     */
    case '-':
      if (entry === '') return '-'
      return isExpression(answer) && /[\dx]$/.test(entry) ? `${entry}-` : entry

    /** Only ever an operator, so it needs something to act on. */
    case '+':
      return /[\dx]$/.test(entry) ? `${entry}+` : entry

    /** One relation, with something on its left. */
    case '<':
    case '>':
      return !/[<>]/.test(entry) && /[\dx]$/.test(entry) ? `${entry}${key}` : entry

    /** A term carries at most one unknown: "7xx" is not an expression. */
    case 'x': {
      const lastTerm = entry.split(/[+-]/).pop() ?? ''
      return lastTerm.includes('x') ? entry : `${entry}x`
    }

    // Children write `.5`; show them `0.5` rather than correcting them later.
    case '.':
      if (entry.includes('.')) return entry
      return entry === '' || entry === '-' ? `${entry}0.` : `${entry}.`

    /**
     * A fraction is held as one string — "3/4" — so parseFraction, check and
     * every existing test work on ordinary text, and the stacked display is a
     * rendering of it.
     */
    case '/':
      return !entry.includes('/') && /\d$/.test(entry) ? `${entry}/` : entry

    /** The join between a quotient and its remainder, or two sides of a ratio. */
    case 'r':
    case ':':
      if (/[r:]/.test(entry) || entry.includes('/') || entry.includes('.')) return entry
      return /\d$/.test(entry) ? `${entry}${key}` : entry

    default:
      return entry + key
  }
}

/**
 * Is this a complete answer? Mid-typing states — `3/`, `7r`, `5-`, `x+` — are
 * not, and must not be submittable: a half-written answer grades as wrong.
 */
export function canSubmit(entry: Entry, answer: Answer): boolean {
  if (entry === '') return false

  switch (answer.kind) {
    case 'choice':
      return true
    case 'expression':
      // An inequality is not finished until it has its relation and both sides.
      if (wantsRelation(answer) && !/[<>]=?.+$/.test(entry)) return false
      return normalise(entry) !== undefined
    case 'fraction':
    case 'mixed':
      return /^-?\d+\/\d+$/.test(entry)
    case 'parts':
      return new RegExp(`^\\d+${answer.separator}\\d+$`).test(entry)
    case 'decimal':
    case 'integer':
    default:
      return /^-?\d*\.?\d*$/.test(entry) && /\d$/.test(entry)
  }
}
