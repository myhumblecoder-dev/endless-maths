/**
 * The skill graph: counting through pre-algebra, ~50 skills across six strands.
 *
 * This is a DAG, not a ladder. `requires` is what makes the diagnostic work — a
 * child failing `p-solve-two-step` may really have an `r-negative-add-sub` gap,
 * and you find that by walking prerequisites backwards. See docs/design.md.
 */

import type { Skill, SkillId } from './types'

export const SKILLS: Skill[] = [
  // ---- number sense -------------------------------------------------------
  { id: 'n-count-20', strand: 'number-sense', kind: 'fact', label: 'Counting to 20', requires: [], answerKind: 'integer', typicalAge: [4, 6] },
  { id: 'n-compare-20', strand: 'number-sense', kind: 'procedure', label: 'Bigger or smaller', requires: ['n-count-20'], answerKind: 'choice', typicalAge: [5, 6] },
  { id: 'n-bonds-10', strand: 'number-sense', kind: 'fact', label: 'Number bonds to 10', requires: ['n-count-20'], answerKind: 'integer', typicalAge: [5, 7] },
  { id: 'n-place-value-100', strand: 'number-sense', kind: 'procedure', label: 'Tens and ones', requires: ['n-count-20'], answerKind: 'integer', typicalAge: [6, 7] },
  { id: 'n-place-value-1000', strand: 'number-sense', kind: 'procedure', label: 'Hundreds, tens and ones', requires: ['n-place-value-100'], answerKind: 'integer', typicalAge: [7, 8] },
  { id: 'n-round', strand: 'number-sense', kind: 'procedure', label: 'Rounding', requires: ['n-place-value-1000'], answerKind: 'integer', typicalAge: [8, 9] },

  // ---- addition & subtraction ---------------------------------------------
  { id: 'a-add-within-10', strand: 'add-sub', kind: 'fact', label: 'Adding to 10', requires: ['n-bonds-10'], answerKind: 'integer', typicalAge: [5, 6] },
  { id: 'a-sub-within-10', strand: 'add-sub', kind: 'fact', label: 'Taking away within 10', requires: ['a-add-within-10'], answerKind: 'integer', typicalAge: [5, 7] },
  { id: 'a-add-within-20', strand: 'add-sub', kind: 'fact', label: 'Adding to 20', requires: ['a-add-within-10'], answerKind: 'integer', typicalAge: [6, 7] },
  { id: 'a-sub-within-20', strand: 'add-sub', kind: 'fact', label: 'Taking away within 20', requires: ['a-sub-within-10', 'a-add-within-20'], answerKind: 'integer', typicalAge: [6, 7] },
  { id: 'a-add-2digit', strand: 'add-sub', kind: 'procedure', label: 'Adding two-digit numbers', requires: ['a-add-within-20', 'n-place-value-100'], answerKind: 'integer', typicalAge: [7, 8] },
  { id: 'a-add-2digit-regroup', strand: 'add-sub', kind: 'procedure', label: 'Adding with carrying', requires: ['a-add-2digit'], answerKind: 'integer', typicalAge: [7, 9] },
  { id: 'a-sub-2digit', strand: 'add-sub', kind: 'procedure', label: 'Subtracting two-digit numbers', requires: ['a-sub-within-20', 'n-place-value-100'], answerKind: 'integer', typicalAge: [7, 8] },
  { id: 'a-sub-2digit-regroup', strand: 'add-sub', kind: 'procedure', label: 'Subtracting with borrowing', requires: ['a-sub-2digit'], answerKind: 'integer', typicalAge: [7, 9] },
  { id: 'a-add-3digit', strand: 'add-sub', kind: 'procedure', label: 'Adding three-digit numbers', requires: ['a-add-2digit-regroup', 'n-place-value-1000'], answerKind: 'integer', typicalAge: [8, 9] },
  { id: 'a-sub-3digit', strand: 'add-sub', kind: 'procedure', label: 'Subtracting three-digit numbers', requires: ['a-sub-2digit-regroup', 'n-place-value-1000'], answerKind: 'integer', typicalAge: [8, 9] },

  // ---- multiplication & division ------------------------------------------
  // Split by difficulty, not by "times tables" as one blob: 2/5/10 are nearly
  // free, 6-9 are where children actually struggle.
  { id: 'm-times-2-5-10', strand: 'mul-div', kind: 'fact', label: 'The 2, 5 and 10 times tables', requires: ['a-add-within-20'], answerKind: 'integer', typicalAge: [6, 8] },
  { id: 'm-times-3-4', strand: 'mul-div', kind: 'fact', label: 'The 3 and 4 times tables', requires: ['m-times-2-5-10'], answerKind: 'integer', typicalAge: [7, 9] },
  { id: 'm-times-6-7-8-9', strand: 'mul-div', kind: 'fact', label: 'The 6, 7, 8 and 9 times tables', requires: ['m-times-3-4'], answerKind: 'integer', typicalAge: [8, 10] },
  { id: 'm-div-2-5-10', strand: 'mul-div', kind: 'fact', label: 'Dividing by 2, 5 and 10', requires: ['m-times-2-5-10'], answerKind: 'integer', typicalAge: [7, 9] },
  { id: 'm-div-3-4', strand: 'mul-div', kind: 'fact', label: 'Dividing by 3 and 4', requires: ['m-times-3-4', 'm-div-2-5-10'], answerKind: 'integer', typicalAge: [8, 9] },
  { id: 'm-div-6-7-8-9', strand: 'mul-div', kind: 'fact', label: 'Dividing by 6, 7, 8 and 9', requires: ['m-times-6-7-8-9', 'm-div-3-4'], answerKind: 'integer', typicalAge: [9, 10] },
  { id: 'm-div-remainder', strand: 'mul-div', kind: 'procedure', label: 'Division with remainders', requires: ['m-div-6-7-8-9'], answerKind: 'parts', typicalAge: [9, 10] },
  { id: 'm-2digit-x-1digit', strand: 'mul-div', kind: 'procedure', label: 'Two-digit times one-digit', requires: ['m-times-6-7-8-9', 'a-add-2digit-regroup'], answerKind: 'integer', typicalAge: [9, 10] },
  { id: 'm-long-mult', strand: 'mul-div', kind: 'procedure', label: 'Long multiplication', requires: ['m-2digit-x-1digit'], answerKind: 'integer', typicalAge: [10, 11] },
  { id: 'm-long-div', strand: 'mul-div', kind: 'procedure', label: 'Long division', requires: ['m-div-remainder', 'm-long-mult'], answerKind: 'integer', typicalAge: [10, 12] },

  // ---- fractions, decimals, percentages -----------------------------------
  { id: 'f-identify', strand: 'fractions', kind: 'procedure', label: 'What is a fraction?', requires: ['m-div-2-5-10'], answerKind: 'fraction', typicalAge: [7, 9] },
  { id: 'f-equivalent', strand: 'fractions', kind: 'procedure', label: 'Equivalent fractions', requires: ['f-identify', 'm-times-3-4'], answerKind: 'integer', typicalAge: [8, 10] },
  { id: 'f-compare', strand: 'fractions', kind: 'procedure', label: 'Comparing fractions', requires: ['f-equivalent'], answerKind: 'choice', typicalAge: [9, 10] },
  { id: 'f-add-like', strand: 'fractions', kind: 'procedure', label: 'Adding fractions, same denominator', requires: ['f-identify'], answerKind: 'fraction', typicalAge: [8, 10] },
  { id: 'f-sub-like', strand: 'fractions', kind: 'procedure', label: 'Subtracting fractions, same denominator', requires: ['f-add-like'], answerKind: 'fraction', typicalAge: [8, 10] },
  { id: 'f-add-unlike', strand: 'fractions', kind: 'procedure', label: 'Adding fractions, different denominators', requires: ['f-add-like', 'f-equivalent', 'r-factors-multiples'], answerKind: 'fraction', typicalAge: [10, 12] },
  { id: 'f-multiply', strand: 'fractions', kind: 'procedure', label: 'Multiplying fractions', requires: ['f-equivalent'], answerKind: 'fraction', typicalAge: [10, 12] },
  { id: 'f-divide', strand: 'fractions', kind: 'procedure', label: 'Dividing fractions', requires: ['f-multiply'], answerKind: 'fraction', typicalAge: [11, 13] },
  { id: 'f-decimal-place-value', strand: 'fractions', kind: 'procedure', label: 'Tenths and hundredths', requires: ['n-place-value-1000', 'f-identify'], answerKind: 'integer', typicalAge: [9, 10] },
  { id: 'f-decimal-add-sub', strand: 'fractions', kind: 'procedure', label: 'Adding and subtracting decimals', requires: ['f-decimal-place-value', 'a-add-3digit'], answerKind: 'decimal', typicalAge: [9, 11] },
  { id: 'f-decimal-mult', strand: 'fractions', kind: 'procedure', label: 'Multiplying decimals', requires: ['f-decimal-add-sub', 'm-long-mult'], answerKind: 'decimal', typicalAge: [10, 12] },
  { id: 'f-convert-fdp', strand: 'fractions', kind: 'procedure', label: 'Fractions, decimals and percentages', requires: ['f-decimal-place-value', 'f-equivalent'], answerKind: ['decimal', 'integer', 'fraction'], typicalAge: [10, 12] },
  { id: 'f-percent-of', strand: 'fractions', kind: 'procedure', label: 'Percentages of amounts', requires: ['f-convert-fdp', 'm-2digit-x-1digit'], answerKind: 'integer', typicalAge: [10, 12] },

  // ---- ratio, negatives, order of operations ------------------------------
  { id: 'r-factors-multiples', strand: 'ratio-negatives', kind: 'procedure', label: 'Factors and multiples', requires: ['m-div-6-7-8-9'], answerKind: 'set', typicalAge: [9, 11] },
  { id: 'r-primes', strand: 'ratio-negatives', kind: 'fact', label: 'Prime numbers', requires: ['r-factors-multiples'], answerKind: 'choice', typicalAge: [10, 11] },
  { id: 'r-squares', strand: 'ratio-negatives', kind: 'fact', label: 'Square numbers', requires: ['m-times-6-7-8-9'], answerKind: 'integer', typicalAge: [9, 11] },
  { id: 'r-order-of-ops', strand: 'ratio-negatives', kind: 'procedure', label: 'Order of operations', requires: ['m-2digit-x-1digit', 'a-add-3digit'], answerKind: 'integer', typicalAge: [10, 12] },
  { id: 'r-negative-add-sub', strand: 'ratio-negatives', kind: 'procedure', label: 'Adding and subtracting negatives', requires: ['a-sub-3digit'], answerKind: 'integer', typicalAge: [10, 12] },
  { id: 'r-negative-mul-div', strand: 'ratio-negatives', kind: 'procedure', label: 'Multiplying and dividing negatives', requires: ['r-negative-add-sub', 'm-long-div'], answerKind: 'integer', typicalAge: [11, 13] },
  { id: 'r-ratio-simplify', strand: 'ratio-negatives', kind: 'procedure', label: 'Simplifying ratios', requires: ['r-factors-multiples', 'f-equivalent'], answerKind: 'set', typicalAge: [10, 12] },
  { id: 'r-proportion', strand: 'ratio-negatives', kind: 'procedure', label: 'Proportion', requires: ['r-ratio-simplify'], answerKind: 'integer', typicalAge: [11, 13] },

  // ---- pre-algebra --------------------------------------------------------
  { id: 'p-evaluate', strand: 'pre-algebra', kind: 'procedure', label: 'Working out expressions', requires: ['r-order-of-ops', 'r-negative-add-sub'], answerKind: 'integer', typicalAge: [11, 12] },
  { id: 'p-like-terms', strand: 'pre-algebra', kind: 'procedure', label: 'Collecting like terms', requires: ['p-evaluate'], answerKind: 'expression', typicalAge: [11, 13] },
  { id: 'p-distribute', strand: 'pre-algebra', kind: 'procedure', label: 'Expanding brackets', requires: ['p-like-terms', 'r-negative-mul-div'], answerKind: 'expression', typicalAge: [11, 13] },
  { id: 'p-solve-one-step', strand: 'pre-algebra', kind: 'procedure', label: 'One-step equations', requires: ['p-evaluate'], answerKind: 'integer', typicalAge: [11, 12] },
  { id: 'p-solve-two-step', strand: 'pre-algebra', kind: 'procedure', label: 'Two-step equations', requires: ['p-solve-one-step', 'r-negative-add-sub'], answerKind: 'integer', typicalAge: [11, 13] },
  { id: 'p-solve-both-sides', strand: 'pre-algebra', kind: 'procedure', label: 'Unknowns on both sides', requires: ['p-solve-two-step', 'p-like-terms'], answerKind: 'integer', typicalAge: [12, 13] },
  { id: 'p-inequalities', strand: 'pre-algebra', kind: 'procedure', label: 'Inequalities', requires: ['p-solve-two-step', 'n-compare-20'], answerKind: 'expression', typicalAge: [12, 13] },
  { id: 'p-formula', strand: 'pre-algebra', kind: 'procedure', label: 'Using formulas', requires: ['p-evaluate', 'f-decimal-mult'], answerKind: 'decimal', typicalAge: [12, 13] },
]

export const SKILL_BY_ID: ReadonlyMap<SkillId, Skill> = new Map(
  SKILLS.map((s) => [s.id, s]),
)

/**
 * Every unmastered prerequisite of `skill`, depth-first, deepest first.
 *
 * This is the diagnostic: when a child fails two-step equations, the gap is
 * usually further down. The first entry is where to actually send them.
 */
export function findGaps(
  skill: SkillId,
  isMastered: (id: SkillId) => boolean,
  seen: Set<SkillId> = new Set(),
): SkillId[] {
  if (seen.has(skill)) return []
  seen.add(skill)

  const def = SKILL_BY_ID.get(skill)
  if (!def) return []

  const gaps: SkillId[] = []
  for (const req of def.requires) {
    gaps.push(...findGaps(req, isMastered, seen))
    if (!isMastered(req)) gaps.push(req)
  }
  return gaps
}
