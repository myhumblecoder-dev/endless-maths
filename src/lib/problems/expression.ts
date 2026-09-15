/**
 * Canonical form for linear expressions in one variable.
 *
 * This exists because the MathLive spike (docs/research.md) showed the
 * alternative was roughly 1.5 MB of computer-algebra system to grade three
 * skills. The grammar these skills need is tiny — `7x + 5`, `6x + 15`,
 * `x > 5` — so the canonicaliser that seemed like the expensive part turns out
 * to be about a hundred lines with no dependency at all.
 *
 * Deliberately narrow. No brackets, no powers, no second variable: anything it
 * does not understand returns `undefined` and grades incorrect, rather than
 * being guessed at.
 */

export type Relation = '<' | '>' | '<=' | '>=' | '='

const RELATIONS: Relation[] = ['<=', '>=', '<', '>', '=']

/** A linear expression reduced to a coefficient of x and a constant. */
type Linear = { x: number; k: number }

/** Normalise the characters a learner or a keyboard might produce. */
const tidy = (text: string): string =>
  text
    .replace(/[−–—]/g, '-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/\s+/g, '')

/**
 * Sum the terms of one side. Returns `undefined` rather than guessing when it
 * meets anything outside the grammar.
 */
function parseLinear(text: string): Linear | undefined {
  if (text === '') return undefined

  // Split before each sign, keeping the sign with its term: "5x-3" -> 5x, -3
  const terms = text.replace(/([+-])/g, ' $1').trim().split(/\s+/)
  const total: Linear = { x: 0, k: 0 }

  for (const term of terms) {
    if (term === '' || term === '+' || term === '-') return undefined

    const m = term.match(/^([+-]?)(\d*)(x?)$/)
    if (!m) return undefined

    const [, sign, digits, variable] = m
    // A term must carry something: "+" alone, or an empty body, is malformed.
    if (digits === '' && variable === '') return undefined

    const magnitude = digits === '' ? 1 : Number(digits)
    const value = sign === '-' ? -magnitude : magnitude

    if (variable === 'x') total.x += value
    else total.k += value
  }

  return total
}

/**
 * Write a linear expression the one agreed way, so equal ones match as strings.
 * Exported as `linear` for generators, which must not build canonical forms by
 * concatenation: "-2x" + "+" + "-16" gives "-2x+-16", which is not an
 * expression at all.
 */
function writeLinear({ x, k }: Linear): string {
  if (x === 0) return `${k}`
  const head = x === 1 ? 'x' : x === -1 ? '-x' : `${x}x`
  if (k === 0) return head
  return k > 0 ? `${head}+${k}` : `${head}-${Math.abs(k)}`
}

/**
 * The canonical form of an expression or inequality, or `undefined` if it is
 * not one. Two inputs mean the same thing exactly when their canonical forms
 * are identical strings.
 */
export function normalise(text: string): string | undefined {
  const cleaned = tidy(text)
  if (cleaned === '') return undefined

  // An inequality is two expressions and the relation between them. Checked
  // longest-first so "<=" is not mistaken for "<".
  for (const relation of RELATIONS) {
    const at = cleaned.indexOf(relation)
    if (at === -1) continue

    const left = parseLinear(cleaned.slice(0, at))
    const right = parseLinear(cleaned.slice(at + relation.length))
    if (!left || !right) return undefined
    return `${writeLinear(left)}${relation}${writeLinear(right)}`
  }

  const parsed = parseLinear(cleaned)
  return parsed ? writeLinear(parsed) : undefined
}

/** Canonical form of `x` lots of x plus `k`. Use this rather than string joining. */
export const linear = (x: number, k: number): string => writeLinear({ x, k })
