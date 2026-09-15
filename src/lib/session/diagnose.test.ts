import { test } from 'vitest'
import assert from 'node:assert/strict'
import { isStruggling, gapBehind, STRUGGLE_ATTEMPTS, STRUGGLE_RATE } from './diagnose'
import { emptyProgress, record, type Progress } from '@/lib/mastery/mastery'
import type { SkillId } from '@/lib/curriculum/types'
import { IMPLEMENTED } from '@/lib/problems'

/** Record `n` attempts at `skill`, `correct` of them right. */
function attempts(p: Progress, skill: SkillId, n: number, correct: number): Progress {
  for (let i = 0; i < n; i++) {
    p = record(p, {
      problemId: `${skill}#${i}`, skill,
      given: 'x', verdict: i < correct ? 'correct' : 'incorrect',
      elapsedMs: 3000, at: i,
    })
  }
  return p
}

// ---- when to intervene ----------------------------------------------------

test('one wrong answer is not struggling', () => {
  const p = attempts(emptyProgress(), 'p-solve-two-step', 1, 0)
  assert.equal(isStruggling(p, 'p-solve-two-step'), false, 'everyone gets one wrong')
})

test('a few wrong answers early on is not yet struggling', () => {
  const p = attempts(emptyProgress(), 'p-solve-two-step', STRUGGLE_ATTEMPTS - 1, 0)
  assert.equal(isStruggling(p, 'p-solve-two-step'), false, 'needs enough attempts to be a signal')
})

test('persistently getting a skill wrong is struggling', () => {
  const p = attempts(emptyProgress(), 'p-solve-two-step', STRUGGLE_ATTEMPTS, 1)
  assert.equal(isStruggling(p, 'p-solve-two-step'), true)
})

test('getting most of them right is not struggling', () => {
  const p = attempts(emptyProgress(), 'p-solve-two-step', 10, 9)
  assert.ok(STRUGGLE_RATE < 0.9)
  assert.equal(isStruggling(p, 'p-solve-two-step'), false)
})

test('an unseen skill is not struggling', () => {
  assert.equal(isStruggling(emptyProgress(), 'p-solve-two-step'), false)
})

// ---- what to suggest ------------------------------------------------------

/**
 * The payoff: a learner failing two-step equations usually has a gap further
 * down. Sending them back to the real gap is the most valuable personalization
 * in the product, and it involves no model at all.
 */
test('failing two-step equations points at the negatives gap beneath it', () => {
  let p: Progress = {
    ...emptyProgress(),
    // Placed high, but negatives were never actually demonstrated.
    placed: ['n-bonds-10', 'n-compare-20', 'n-place-value-100', 'n-place-value-1000', 'n-round',
             'a-add-within-10', 'a-sub-within-10', 'a-add-within-20', 'a-sub-within-20',
             'a-add-2digit', 'a-add-2digit-regroup', 'a-sub-2digit', 'a-sub-2digit-regroup',
             'a-add-3digit', 'a-sub-3digit', 'm-times-2-5-10', 'm-times-3-4', 'm-times-6-7-8-9',
             'm-2digit-x-1digit', 'r-order-of-ops', 'p-evaluate', 'p-solve-one-step'],
    placementDone: true,
  }
  p = attempts(p, 'p-solve-two-step', STRUGGLE_ATTEMPTS, 0)
  assert.equal(gapBehind(p, 'p-solve-two-step'), 'r-negative-add-sub')
})

test('a learner with every prerequisite mastered is not diverted', () => {
  // Naming a few prerequisites is not enough — findGaps walks the whole DAG, so
  // anything unmastered further down is a genuine gap. This learner has it all.
  let p: Progress = {
    ...emptyProgress(),
    placed: IMPLEMENTED.filter((s) => s !== 'p-solve-two-step'),
    placementDone: true,
  }
  p = attempts(p, 'p-solve-two-step', STRUGGLE_ATTEMPTS, 0)
  assert.equal(
    gapBehind(p, 'p-solve-two-step'), undefined,
    'nothing beneath them is missing, so the honest answer is that this skill is just hard',
  )
})

test('only skills we can actually generate are suggested', () => {
  const p = attempts(emptyProgress(), 'f-add-unlike' as SkillId, STRUGGLE_ATTEMPTS, 0)
  const gap = gapBehind(p, 'f-add-unlike' as SkillId)
  // f-identify and r-factors-multiples are unbuilt; never send a learner there.
  assert.ok(gap === undefined || !['f-identify', 'r-factors-multiples'].includes(gap))
})

test('nothing is suggested for a skill that is going fine', () => {
  const p = attempts(emptyProgress(), 'p-solve-two-step', 10, 10)
  assert.equal(gapBehind(p, 'p-solve-two-step'), undefined)
})
