/**
 * The Tier 1 spine: every skill answerable with a numeric keypad (plus three
 * buttons for comparison and yes/no), from number bonds to unknowns on both
 * sides of an equation.
 *
 * Deliberately excluded — see docs/design.md § Implementation tiers:
 *  - the rest of the fractions strand (adding, subtracting, multiplying, dividing)
 *  - counting to 20 (needs a visual counting interface)
 */

import type { Generator, Problem, Rng, SkillId } from '@/lib/curriculum/types'
import * as ns from './numberSense'
import * as as from './addSub'
import * as md from './mulDiv'
import * as rn from './ratioNegatives'
import * as dc from './decimals'
import * as fr from './fractions'
import * as pa from './preAlgebra'

export const GENERATORS = {
  'n-bonds-10': ns.nBonds10,
  'n-compare-20': ns.nCompare20,
  'n-place-value-100': ns.nPlaceValue100,
  'n-place-value-1000': ns.nPlaceValue1000,
  'n-round': ns.nRound,

  'a-add-within-10': as.aAddWithin10,
  'a-sub-within-10': as.aSubWithin10,
  'a-add-within-20': as.aAddWithin20,
  'a-sub-within-20': as.aSubWithin20,
  'a-add-2digit': as.aAdd2Digit,
  'a-add-2digit-regroup': as.aAdd2DigitRegroup,
  'a-sub-2digit': as.aSub2Digit,
  'a-sub-2digit-regroup': as.aSub2DigitRegroup,
  'a-add-3digit': as.aAdd3Digit,
  'a-sub-3digit': as.aSub3Digit,

  'm-times-2-5-10': md.mTimes2510,
  'm-times-3-4': md.mTimes34,
  'm-times-6-7-8-9': md.mTimes6789,
  'm-div-2-5-10': md.mDiv2510,
  'm-div-3-4': md.mDiv34,
  'm-div-6-7-8-9': md.mDiv6789,
  'm-2digit-x-1digit': md.m2DigitBy1Digit,
  'm-div-remainder': md.mDivRemainder,
  'm-long-mult': md.mLongMult,
  'm-long-div': md.mLongDiv,

  'r-primes': rn.rPrimes,
  'r-squares': rn.rSquares,
  'r-order-of-ops': rn.rOrderOfOps,
  'r-negative-add-sub': rn.rNegativeAddSub,
  'r-negative-mul-div': rn.rNegativeMulDiv,
  'r-proportion': rn.rProportion,
  'r-factors-multiples': rn.rFactorsMultiples,
  'r-ratio-simplify': rn.rRatioSimplify,

  'f-identify': fr.fIdentify,
  'f-equivalent': fr.fEquivalent,
  'f-compare': fr.fCompare,
  'f-add-like': fr.fAddLike,
  'f-sub-like': fr.fSubLike,
  'f-add-unlike': fr.fAddUnlike,
  'f-multiply': fr.fMultiply,
  'f-divide': fr.fDivide,
  'f-convert-fdp': fr.fConvertFdp,
  'f-percent-of': dc.fPercentOf,
  'f-decimal-place-value': dc.fDecimalPlaceValue,
  'f-decimal-add-sub': dc.fDecimalAddSub,
  'f-decimal-mult': dc.fDecimalMult,

  'p-evaluate': pa.pEvaluate,
  'p-like-terms': pa.pLikeTerms,
  'p-distribute': pa.pDistribute,
  'p-inequalities': pa.pInequalities,
  'p-solve-one-step': pa.pSolveOneStep,
  'p-solve-two-step': pa.pSolveTwoStep,
  'p-solve-both-sides': pa.pSolveBothSides,
  'p-formula': pa.pFormula,
} satisfies Partial<Record<SkillId, Generator>>

export type ImplementedSkill = keyof typeof GENERATORS

export const IMPLEMENTED = Object.keys(GENERATORS) as ImplementedSkill[]

export function generate(skill: ImplementedSkill, rng: Rng): Problem {
  return GENERATORS[skill](rng)
}

export { seeded } from './rng'
