/**
 * Core curriculum types. See docs/design.md.
 *
 * Two things here are load-bearing and easy to get wrong later:
 *  - `Answer` is a tagged union, not a number. Fractions and expressions have
 *    multiple correct spellings, so equality is per-kind.
 *  - `Skill.kind` splits facts from procedures. They schedule differently and
 *    speed only means something for facts.
 */

export type Strand =
  | 'number-sense'
  | 'add-sub'
  | 'mul-div'
  | 'fractions'
  | 'ratio-negatives'
  | 'pre-algebra'

/**
 * A fact is one of a finite, memorizable set (`7 × 8`) — mastery means fast
 * recall. A procedure has unbounded instances (solve `3x + 4 = 19`) — mastery
 * means a reliable success rate, and taking time over it is correct behaviour.
 */
export type SkillKind = 'fact' | 'procedure'

export type AnswerKind =
  | 'integer'
  | 'decimal'
  | 'fraction'
  | 'mixed'
  | 'expression'
  | 'set'

export type Answer =
  | { kind: 'integer'; value: number }
  | { kind: 'decimal'; value: number; dp: number }
  | { kind: 'fraction'; num: number; den: number }
  | { kind: 'mixed'; whole: number; num: number; den: number }
  /** `canonical` is a normalized spelling, so `3 + 5x` and `5x + 3` compare equal. */
  | { kind: 'expression'; canonical: string }
  /** Order-independent, e.g. the factor pairs of 24. */
  | { kind: 'set'; values: Answer[] }

/**
 * Grading has three outcomes, not two. `6/8` for `3/4` is not wrong — it is
 * unfinished, and telling a child otherwise teaches them the wrong lesson.
 */
export type Verdict = 'correct' | 'equivalent-unsimplified' | 'incorrect'

export type Skill = {
  id: SkillId
  strand: Strand
  kind: SkillKind
  /** Child-facing, e.g. "The 7, 8 and 9 times tables". */
  label: string
  /** Must all be mastered before this is scheduled. Forms a DAG. */
  requires: SkillId[]
  answerKind: AnswerKind
  /** Rough age band, for placement only — never shown to the child. */
  typicalAge: [number, number]
}

/** A generated item. Problem and answer are always separate fields. */
export type Problem = {
  /** Stable within a session; regenerating from the same seed reproduces it. */
  id: string
  skill: SkillId
  /** Rendered prompt, e.g. "7 × 8" or "3x + 4 = 19". */
  prompt: string
  answer: Answer
  /** Present only for facts — the spaced-repetition key, e.g. "mul:7x8". */
  factKey?: string
  /** Retained so weakness can be attributed (e.g. all ×7 facts are shaky). */
  operands: number[]
}

/** Spaced-repetition state for one fact. Lives in localStorage, never sent anywhere. */
export type FactState = {
  factKey: string
  /** Leitner box; higher = longer interval. */
  box: number
  seen: number
  correct: number
  /** Fluency signal. A fact is mastered only when this is under the threshold. */
  medianMs: number
  lastSeenAt: number
}

/** Aggregate state for a procedure skill, where per-instance history is meaningless. */
export type SkillState = {
  skill: SkillId
  attempts: number
  /** Success rate over a trailing window, not all time. */
  recentCorrectRate: number
  lastSeenAt: number
  mastered: boolean
}

export type Attempt = {
  problemId: string
  skill: SkillId
  factKey?: string
  given: string
  verdict: Verdict
  elapsedMs: number
  at: number
}

/** Seeded so a session is reproducible and generation needs no network. */
export type Rng = () => number

export type Generator = (rng: Rng) => Problem

export type SkillId =
  // number sense
  | 'n-count-20' | 'n-compare-20' | 'n-bonds-10' | 'n-place-value-100'
  | 'n-place-value-1000' | 'n-round'
  // addition & subtraction
  | 'a-add-within-10' | 'a-sub-within-10' | 'a-add-within-20' | 'a-sub-within-20'
  | 'a-add-2digit' | 'a-add-2digit-regroup' | 'a-sub-2digit' | 'a-sub-2digit-regroup'
  | 'a-add-3digit' | 'a-sub-3digit'
  // multiplication & division
  | 'm-times-2-5-10' | 'm-times-3-4' | 'm-times-6-7-8-9'
  | 'm-div-2-5-10' | 'm-div-3-4' | 'm-div-6-7-8-9' | 'm-div-remainder'
  | 'm-2digit-x-1digit' | 'm-long-mult' | 'm-long-div'
  // fractions, decimals, percentages
  | 'f-identify' | 'f-equivalent' | 'f-compare' | 'f-add-like' | 'f-sub-like'
  | 'f-add-unlike' | 'f-multiply' | 'f-divide'
  | 'f-decimal-place-value' | 'f-decimal-add-sub' | 'f-decimal-mult'
  | 'f-convert-fdp' | 'f-percent-of'
  // ratio, negatives, order of operations
  | 'r-factors-multiples' | 'r-primes' | 'r-squares' | 'r-order-of-ops'
  | 'r-negative-add-sub' | 'r-negative-mul-div' | 'r-ratio-simplify' | 'r-proportion'
  // pre-algebra
  | 'p-evaluate' | 'p-like-terms' | 'p-distribute'
  | 'p-solve-one-step' | 'p-solve-two-step' | 'p-solve-both-sides'
  | 'p-inequalities' | 'p-formula'
