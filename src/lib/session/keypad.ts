/**
 * What the child has typed so far, and what a key press does to it.
 *
 * Pure string-in, string-out, so the keypad rules are testable without a DOM
 * and the component stays a rendering concern.
 */

export type Entry = string

export type Key = 'back' | 'clear' | '-' | '.' | string

/** Ten characters is already more than any Tier 1 answer needs. */
const MAX_LENGTH = 10

export function press(entry: Entry, key: Key): Entry {
  switch (key) {
    case 'back':
      return entry.slice(0, -1)

    case 'clear':
      return ''

    // Only meaningful at the front, and only once.
    case '-':
      return entry === '' ? '-' : entry

    // Children write `.5`; show them `0.5` rather than correcting them later.
    case '.':
      if (entry.includes('.')) return entry
      return entry === '' || entry === '-' ? `${entry}0.` : `${entry}.`

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
  if (/^-?\d*\.?\d*$/.test(entry)) return /\d$/.test(entry)
  return true // choice answers: 'yes', '<', and so on
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
  return /^[0-9]$/.test(key) || key === '-' || key === '.'
}
