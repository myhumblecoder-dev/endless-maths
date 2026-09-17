import { test } from 'vitest'
import assert from 'node:assert/strict'
import { pickTopic, strengthOf, topicIsA } from './weakest'
import { emptyProgress, record, type Progress } from '@/lib/mastery/mastery'
import { recordPass, setDifficulty } from '@/lib/mastery/levels'
import type { ImplementedSkill } from '@/lib/problems'
import type { SkillId } from '@/lib/curriculum/types'

const placed = (...skills: SkillId[]): Progress => ({
  ...emptyProgress(), placementDone: true, placed: skills,
})

/** `n` answers on a skill, `wrong` of them incorrect. */
function practised(progress: Progress, skill: ImplementedSkill, n: number, wrong: number): Progress {
  let out = progress
  for (let i = 0; i < n; i++) {
    out = record(out, {
      problemId: `${skill}#${i}`, skill, given: '?',
      verdict: i < wrong ? 'incorrect' : 'correct', elapsedMs: 1000, at: i,
    })
  }
  return out
}

test('a learner with nothing behind them gets a sensible opening topic', () => {
  const { skill } = pickTopic(emptyProgress())
  assert.equal(skill, 'n-bonds-10', 'the root of the graph is where a beginner starts')
})

/**
 * The whole point of the placement quiz. A thirteen-year-old who placed into
 * two-step equations must not be handed number bonds because they happen to be
 * first in the list.
 */
test('a learner who placed out of the basics is not sent back to them', () => {
  const p = placed('n-bonds-10', 'n-compare-20', 'a-add-within-10', 'a-sub-within-10',
    'a-add-within-20', 'a-sub-within-20')
  const { skill } = pickTopic(p)
  assert.ok(!p.placed.includes(skill), `sent back to ${skill}, which they placed out of`)
})

test('a topic they are getting wrong beats a topic they have never met', () => {
  const p = practised(placed('n-bonds-10', 'a-add-within-10'), 'a-add-within-10', 10, 6)
  const { skill, reason } = pickTopic(p)
  assert.equal(skill, 'a-add-within-10')
  assert.equal(reason, 'struggling')
})

test('between two they are getting wrong, the worse one is picked', () => {
  // Two roots of the graph, so neither stands on the other — otherwise the
  // foundation rule answers the question before weakness gets a say.
  let p = placed('n-compare-20', 'n-place-value-100')
  p = practised(p, 'n-compare-20', 10, 4)
  p = practised(p, 'n-place-value-100', 10, 7)
  assert.equal(pickTopic(p).skill, 'n-place-value-100')
})

// ---- difficulty is part of weakness ----------------------------------------

/**
 * "It stays weakest for the topic." Dropping the level gives a child a way
 * through; it must not give them a way out. Ninety-five per cent of the simple
 * version is less than ninety-five per cent of the hard one, and the scoring
 * has to say so or the drop becomes an escape hatch.
 */
test('the same accuracy is worth less at a lower level', () => {
  let p = placed('a-add-3digit', 'a-sub-3digit', 'n-bonds-10')
  p = practised(p, 'a-add-3digit', 10, 0)
  p = practised(p, 'a-sub-3digit', 10, 0)
  p = setDifficulty(p, 'a-add-3digit', 'simple')
  p = setDifficulty(p, 'a-sub-3digit', 'difficult')

  assert.ok(strengthOf(p, 'a-add-3digit') < strengthOf(p, 'a-sub-3digit'),
    'a perfect score on the easy version is not the same achievement')
})

/**
 * The level only drops after a child hits the session cap, so a topic sitting
 * at simple is a topic they failed. Passing the easier version clears the
 * session; it does not clear the debt.
 */
test('a topic beaten only at simple keeps coming back, ahead of anything new', () => {
  let p = placed('n-round', 'n-place-value-1000', 'n-place-value-100')
  p = practised(p, 'n-round', 10, 0)
  p = recordPass(p, 'n-round', 'simple')

  const pick = pickTopic(p)
  assert.equal(pick.skill, 'n-round', 'beating the easy version is not beating the topic')
  assert.equal(pick.reason, 'climbing')
})

/**
 * What they were PROVED at, not what they are queued to be asked next. Beating
 * the simple version steps the level back up to medium, and reading the queued
 * level would count that as having done it at medium before a single question
 * there had been answered.
 */
test('the level queued for next time is not what settles a topic', () => {
  let p = placed('n-round', 'n-place-value-1000', 'n-place-value-100')
  p = practised(p, 'n-round', 10, 0)
  p = recordPass(p, 'n-round', 'simple')
  p = setDifficulty(p, 'n-round', 'medium') // stepped up after beating the easy one

  assert.equal(pickTopic(p).skill, 'n-round', 'the debt is still owed')
})

test('getting back to the normal level settles it', () => {
  let p = placed('n-round', 'n-place-value-1000', 'n-place-value-100')
  p = practised(p, 'n-round', 10, 0)
  p = recordPass(p, 'n-round', 'medium')
  assert.notEqual(pickTopic(p).skill, 'n-round',
    'a topic passed at the usual difficulty is finished with for now')
})

/** Placement, and every record written before levels existed, is taken at face value. */
test('a topic with nothing recorded is settled on mastery alone', () => {
  const p = practised(placed('n-round', 'n-place-value-1000', 'n-place-value-100'), 'n-round', 10, 0)
  assert.notEqual(pickTopic(p).skill, 'n-round')
})

/**
 * A times table has no easier or harder version — it is a hundred facts, each
 * already scheduled on its own. Scoring it as though it were stuck on "medium"
 * would keep it permanently below anything that CAN be taken to difficult,
 * and the child would never leave it.
 */
test('a topic with no levels is not penalised for not having them', () => {
  let p = placed('m-times-6-7-8-9', 'a-add-3digit')
  p = practised(p, 'm-times-6-7-8-9', 10, 0)
  p = practised(p, 'a-add-3digit', 10, 0)
  p = setDifficulty(p, 'a-add-3digit', 'difficult')

  assert.equal(strengthOf(p, 'm-times-6-7-8-9'), strengthOf(p, 'a-add-3digit'),
    'a perfect fact topic is as finished as a perfect topic at full difficulty')
})

// ---- foundations -----------------------------------------------------------

/**
 * Practice can overturn a placement, so a prerequisite can rot underneath
 * something already unlocked. Drilling the thing on top is then the one choice
 * guaranteed not to help.
 */
test('a rotted foundation is practised instead of the thing standing on it', () => {
  let p = placed('n-bonds-10', 'a-add-within-10', 'a-sub-within-10', 'a-add-within-20')
  // Failing the prerequisite hard enough that practice overturns the placement.
  p = practised(p, 'a-add-within-10', 12, 11)
  p = practised(p, 'a-add-within-20', 10, 5)

  const { skill } = pickTopic(p)
  assert.equal(skill, 'a-add-within-10', 'shore up what it stands on')
})

// ---- invariants ------------------------------------------------------------

test('the topic picked is always one they are allowed to meet', () => {
  const cases: Progress[] = [
    emptyProgress(),
    placed('n-bonds-10'),
    practised(placed('n-bonds-10', 'a-add-within-10'), 'a-add-within-10', 9, 9),
    { ...emptyProgress(), placementDone: true, placed: [], facts: {}, skills: {} },
  ]
  for (const p of cases) {
    const { skill } = pickTopic(p)
    assert.ok(skill, 'there is always something to practise')
    assert.equal(typeof skill, 'string')
  }
})

test('picking is deterministic — the same state gives the same topic', () => {
  const p = practised(placed('n-bonds-10', 'a-add-within-10'), 'a-add-within-10', 10, 5)
  assert.deepEqual(pickTopic(p), pickTopic(p))
})

test('every pick says why, so the child is told rather than just moved', () => {
  const reasons = new Set([
    pickTopic(emptyProgress()).reason,
    pickTopic(practised(placed('n-bonds-10', 'a-add-within-10'), 'a-add-within-10', 10, 6)).reason,
  ])
  for (const r of reasons) {
    assert.ok(['struggling', 'climbing', 'new', 'polish', 'foundation'].includes(r), r)
    assert.ok(topicIsA(r).length > 0, `${r} has nothing to say to the learner`)
  }
})
