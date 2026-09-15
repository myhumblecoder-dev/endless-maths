/**
 * What the child has typed so far, and what a key press does to it.
 *
 * Pure string-in, string-out, so the keypad rules are testable without a DOM
 * and the component stays a rendering concern.
 */

import { normalise } from '@/lib/problems/expression'

export type Entry = string

export type Key = 'back' | 'clear' | '-' | '+' | '.' | '/' | 'r' | ':' | 'x' | string

/** Does the entry already carry a multi-part separator? */
const hasSeparator = (entry: Entry): boolean => /[r:]/.test(entry)

/** Ten characters is already more than any Tier 1 answer needs. */
const MAX_LENGTH = 10

export function press(entry: Entry, key: Key): Entry {
  switch (key) {
    case 'back':
      return entry.slice(0, -1)

    case 'clear':
      return ''

    /**
     * A minus is two different things: the sign at the very front of a number,
     * and the operator between two terms of an expression. Both are allowed;
     * two in a row are not.
     */
    case '-':
      if (entry === '') return '-'
      // Never inside a fraction or a multi-part answer — those have no
      // subtraction in them, so a minus there can only be a mistake.
      if (entry.includes('/') || hasSeparator(entry)) return entry
      return /[\dx]$/.test(entry) ? `${entry}-` : entry

    /** Only ever an operator, so it needs something to act on. */
    case '+':
      return /[\dx]$/.test(entry) ? `${entry}+` : entry

    /**
     * The unknown. Follows a coefficient or stands alone, but a term carries
     * at most one — "7xx" is not an expression.
     */
    case 'x': {
      const lastTerm = entry.split(/[+-]/).pop() ?? ''
      return lastTerm.includes('x') ? entry : `${entry}x`
    }

    // Children write `.5`; show them `0.5` rather than correcting them later.
    case '.':
      if (entry.includes('.') || entry.includes('/')) return entry
      return entry === '' || entry === '-' ? `${entry}0.` : `${entry}.`

    /**
     * A fraction is held as one string — "3/4" — so parseFraction, check and
     * every existing test work unchanged, and the two-box display is just a
     * rendering of it. Needs a numerator first, allows only one slash, and does
     * not mix with a decimal point.
     */
    case '/': {
      if (entry.includes('/') || entry.includes('.') || hasSeparator(entry)) return entry
      return /\d$/.test(entry) ? `${entry}/` : entry
    }

    /**
     * The separator between a quotient and its remainder, or the two sides of a
     * ratio. Same rules as the slash: a number has to come first, it appears
     * once, and it does not mix with a fraction or a decimal.
     */
    case 'r':
    case ':': {
      if (hasSeparator(entry) || entry.includes('/') || entry.includes('.')) return entry
      return /\d$/.test(entry) ? `${entry}${key}` : entry
    }

    default:
      return entry.length >= MAX_LENGTH ? entry : entry + key
  }
}

/**
 * True when the entry is a complete answer. `-` and `3.` are mid-typing, not
 * answers — submitting them would be graded wrong for no reason.
 */
export function canSubmit(entry: Entry): boolean {
  if (entry === '') return false
  // An expression is submittable exactly when it parses.
  if (/[x+]/.test(entry)) return normalise(entry) !== undefined
  // Both halves of a multi-part answer are needed; "7r" is mid-typing.
  if (hasSeparator(entry)) return /^\d+[r:]\d+$/.test(entry)
  // A fraction needs both halves. "3/" is mid-typing, not an answer.
  if (entry.includes('/')) return /^-?\d+\/\d+$/.test(entry)
  if (/^-?\d*\.?\d*$/.test(entry)) return /\d$/.test(entry)
  /**
   * What is left should be a choice value — 'yes', '<'. Anything carrying a
   * digit or an arithmetic character got here by being a malformed number, and
   * must not fall through as though it were a tapped choice.
   */
  return !/[\d.\-]/.test(entry)
}

/**
 * Does this physical key contribute to the answer?
 *
 * Used to spot typing-ahead: a key arriving while feedback is on screen means
 * the learner has moved on, so the feedback should be skipped rather than the
 * keystroke swallowed. Swallowing it truncates their next answer — 12 becomes
 * 2 — and marks a correct answer wrong.
 */
export function isEntryKey(key: string): boolean {
  return /^[0-9]$/.test(key) || ['-', '.', '/', 'r', ':', 'x', '+'].includes(key)
}
