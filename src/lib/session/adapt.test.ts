import { test } from 'vitest'
import assert from 'node:assert/strict'
import { adaptDifficulty, levelNews } from './adapt'
import { difficultyFor, provenAt, setDifficulty } from '@/lib/mastery/levels'
import { emptyProgress, record, type Progress } from '@/lib/mastery/mastery'
import { pickTopic } from './weakest'
import type { Attempt, SkillId } from '@/lib/curriculum/types'
import { SESSION_CAP, type Goal } from './goal'

const MINIMUM = 20

/** The shape a finished session leaves behind. */
const ended = (over: { capped: boolean }): Goal => ({
  window: 20,
  right: over.capped ? 12 : 19,
  required: 18,
  remaining: 0,
  done: !over.capped,
  reachedCap: over.capped,
  over: true,
})

const capped = ended({ capped: true })
const passed = ended({ capped: false })

/**
 * `n` answers on `skill`, `wrong` of them incorrect, plus the interleaved
 * review a real session carries. The level for a topic moves on THAT topic's
 * answers, so the mix has to be there or the tests prove nothing about it.
 */
function attempts(skill: SkillId, n: number, wrong: number, review = 0): Attempt[] {
  const one = (s: SkillId, ok: boolean, i: number): Attempt => ({
    problemId: `${s}#${i}`, skill: s, given: '?',
    verdict: ok ? 'correct' : 'incorrect', elapsedMs: 1000, at: i,
  })
  return [
    ...Array.from({ length: n }, (_, i) => one(skill, i >= wrong, i)),
    ...Array.from({ length: review }, (_, i) => one('n-bonds-10', true, n + i)),
  ]
}

/** A clean run on the topic in hand, of exactly `total` answers. */
const clean = (skill: SkillId, total = MINIMUM) => attempts(skill, total, 0)

/** A run that ran out of questions, going badly on the topic in hand. */
const struggled = (skill: SkillId, total = SESSION_CAP) =>
  attempts(skill, Math.round(total / 2), Math.round(total / 4), Math.round(total / 2))

// ---- running out of questions ----------------------------------------------

/**
 * Hitting the cap is a deferral, not a failure and not mercy. The topic is
 * still their weakest and still comes back — but coming back to the identical
 * wall is not a route through it.
 */
test('hitting the cap makes the topic easier next time', () => {
  const { progress, change } = adaptDifficulty(emptyProgress(), 'a-add-3digit', capped, struggled('a-add-3digit'), MINIMUM)
  assert.equal(difficultyFor(progress, 'a-add-3digit'), 'simple')
  assert.deepEqual(change, { skill: 'a-add-3digit', from: 'medium', to: 'simple', direction: 'easier' })
})

test('there is no level below simple to drop to', () => {
  const start = setDifficulty(emptyProgress(), 'a-add-3digit', 'simple')
  const { progress, change } = adaptDifficulty(start, 'a-add-3digit', capped, struggled('a-add-3digit'), MINIMUM)
  assert.equal(difficultyFor(progress, 'a-add-3digit'), 'simple')
  assert.equal(change, null, 'nothing moved, so nothing is announced')
})

// ---- making it look easy ----------------------------------------------------

test('finishing inside the first twenty makes it harder next time', () => {
  const { progress, change } = adaptDifficulty(emptyProgress(), 'a-add-3digit', passed, clean('a-add-3digit'), MINIMUM)
  assert.equal(difficultyFor(progress, 'a-add-3digit'), 'difficult')
  assert.equal(change?.direction, 'harder')
})

/**
 * Repaying the debt. A topic that was dropped to simple climbs back a step at a
 * time rather than jumping straight to the top — see weakest.ts, where it stays
 * their weakest until it is back at the usual level.
 */
test('a topic that was dropped climbs back one step at a time', () => {
  let p = setDifficulty(emptyProgress(), 'a-add-3digit', 'simple')
  p = adaptDifficulty(p, 'a-add-3digit', passed, clean('a-add-3digit'), MINIMUM).progress
  assert.equal(difficultyFor(p, 'a-add-3digit'), 'medium')
  p = adaptDifficulty(p, 'a-add-3digit', passed, clean('a-add-3digit'), MINIMUM).progress
  assert.equal(difficultyFor(p, 'a-add-3digit'), 'difficult')
})

test('there is no level above difficult to climb to', () => {
  const start = setDifficulty(emptyProgress(), 'a-add-3digit', 'difficult')
  const { change } = adaptDifficulty(start, 'a-add-3digit', passed, clean('a-add-3digit'), MINIMUM)
  assert.equal(change, null)
})

// ---- the ordinary case ------------------------------------------------------

/**
 * Most sessions. They got there, but it took some extra questions — which is
 * what the level they are on is for.
 */
test('finishing after some extra questions changes nothing', () => {
  const { progress, change } = adaptDifficulty(emptyProgress(), 'a-add-3digit', passed, clean('a-add-3digit', 31), MINIMUM)
  assert.equal(difficultyFor(progress, 'a-add-3digit'), 'medium')
  assert.equal(change, null)
})

test('a session still running is not adapted at all', () => {
  const running: Goal = { ...passed, done: false, over: false, remaining: 6 }
  const { change } = adaptDifficulty(emptyProgress(), 'a-add-3digit', running, clean('a-add-3digit', 14), MINIMUM)
  assert.equal(change, null, 'the level moves at the end of a session, not during one')
})

// ---- honesty ----------------------------------------------------------------

/**
 * The child is TOLD when the work changes. Telling them it got easier and then
 * handing them the identical questions is worse than saying nothing, so a topic
 * with one band is never claimed to have moved.
 */
test('a topic with no levels is never said to have changed', () => {
  for (const goal of [capped, passed]) {
    const { change } = adaptDifficulty(emptyProgress(), 'm-times-6-7-8-9', goal, struggled('m-times-6-7-8-9'), MINIMUM)
    assert.equal(change, null, 'a times table has no easier version to offer')
  }
})

test('every change has something to say to the learner', () => {
  const { change } = adaptDifficulty(emptyProgress(), 'a-add-3digit', capped, struggled('a-add-3digit'), MINIMUM)
  assert.ok(change)
  assert.ok(levelNews(change).length > 0)
  assert.doesNotMatch(levelNews(change), /simple|medium|difficult|level/i,
    'a child does not need the internal vocabulary, they need to know what to expect')
})

test('adapting never mutates the progress it was given', () => {
  const before: Progress = emptyProgress()
  const snapshot = JSON.stringify(before)
  adaptDifficulty(before, 'a-add-3digit', capped, struggled('a-add-3digit'), MINIMUM)
  assert.equal(JSON.stringify(before), snapshot)
})

// ---- judged on the right evidence -------------------------------------------

/**
 * Only about half a session is the topic in hand; the rest is interleaved
 * review and stretch. Scoring the level move on all of it let a child who was
 * shaky at the topic but fluent at the review facts clear 90% and be pushed UP
 * on the very thing they were struggling with.
 */
test('the level moves on this topic, not on the review that came with it', () => {
  // Half the topic wrong, but a flawless run of review facts alongside it.
  const mixed = attempts('a-add-3digit', 10, 5, 10)
  const { progress, change } = adaptDifficulty(emptyProgress(), 'a-add-3digit', passed, mixed, MINIMUM)

  assert.equal(difficultyFor(progress, 'a-add-3digit'), 'medium',
    'getting the review right is not evidence about the topic')
  assert.equal(change, null)
})

test('a topic they held up on is not dropped because the rest went badly', () => {
  // The session ran out of questions, but this topic was not the problem.
  const notTheirFault = [...attempts('a-add-3digit', 10, 0), ...attempts('n-bonds-10', 30, 20)]
  const { progress } = adaptDifficulty(emptyProgress(), 'a-add-3digit', capped, notTheirFault, MINIMUM)
  assert.equal(difficultyFor(progress, 'a-add-3digit'), 'medium',
    'dropping a topic they were fine at is not a fair reading of the session')
})

test('a session that never asked this topic leaves its level alone', () => {
  const { progress, change } = adaptDifficulty(
    emptyProgress(), 'a-add-3digit', capped, attempts('n-bonds-10', 20, 15), MINIMUM)
  assert.equal(difficultyFor(progress, 'a-add-3digit'), 'medium')
  assert.equal(change, null)
})

// ---- the whole loop ---------------------------------------------------------

/**
 * What #61 to #64 add up to, end to end.
 *
 * A child is stuck on a topic. They run out of questions, so it gets easier —
 * but it is still their weakest and it still comes back. They beat the easier
 * version, which repays the debt rather than settling the topic, so it comes
 * back AGAIN at the usual difficulty. Only when they beat it there are they
 * done with it.
 *
 * The failure this guards against is the drop becoming an escape hatch: fail a
 * topic once, get given a gentler version, pass that, and never see the real
 * one again.
 */
test('failing a topic makes it easier, but does not make it go away', () => {
  const FOCUS = 'a-add-3digit'
  let p: Progress = {
    ...emptyProgress(),
    placementDone: true,
    placed: ['n-bonds-10', 'n-compare-20', 'n-place-value-100', 'n-place-value-1000',
      'a-add-within-10', 'a-sub-within-10', 'a-add-within-20', 'a-sub-within-20',
      'a-add-2digit', 'a-add-2digit-regroup', FOCUS],
  }

  // A session that ran out of questions.
  p = practise(p, FOCUS, 20, 9)
  p = adaptDifficulty(p, FOCUS, capped, struggled(FOCUS), MINIMUM).progress

  assert.equal(difficultyFor(p, FOCUS), 'simple', 'they get a way through')
  assert.equal(pickTopic(p).skill, FOCUS, 'but not a way out')
  assert.equal(pickTopic(p).reason, 'struggling')

  // They beat the gentler version, first time, cleanly.
  p = practise(p, FOCUS, 20, 1)
  p = adaptDifficulty(p, FOCUS, passed, clean(FOCUS), MINIMUM).progress

  assert.equal(difficultyFor(p, FOCUS), 'medium', 'the debt is repaid a step at a time')
  assert.equal(pickTopic(p).skill, FOCUS, 'beating the easy one is not beating the topic')
  assert.equal(pickTopic(p).reason, 'climbing')

  // And they beat it at the level everyone else starts on.
  p = practise(p, FOCUS, 20, 1)
  p = adaptDifficulty(p, FOCUS, passed, clean(FOCUS), MINIMUM).progress

  assert.equal(difficultyFor(p, FOCUS), 'difficult')
  assert.notEqual(pickTopic(p).skill, FOCUS, 'now they are done with it, and move on')
})

/**
 * `n` answers on a skill, `wrong` of them incorrect and SPREAD THROUGH the run.
 *
 * Not bunched at the start: mastery reads a trailing window, so a run whose
 * mistakes are all at the front looks like a perfect one by the end. That is
 * true of a real learner improving, and it is exactly not what a session that
 * ran out of questions looks like.
 */
function practise(progress: Progress, skill: SkillId, n: number, wrong: number): Progress {
  let out = progress
  for (let i = 0; i < n; i++) {
    const missed = Math.floor((i * wrong) / n) !== Math.floor(((i + 1) * wrong) / n)
    out = record(out, {
      problemId: `${skill}#${i}`, skill, given: '?',
      verdict: missed ? 'incorrect' : 'correct', elapsedMs: 1000, at: i,
    })
  }
  return out
}

/**
 * The other half of the trap. A child who scrapes through the gentle version
 * every time — passing, but always needing extra questions — must still get out
 * of it. Simple is a concession, and passing it ends the concession however
 * long it took; only climbing ABOVE the usual level has to be earned cleanly.
 */
test('passing the gentle version restores the normal level, however long it took', () => {
  const start = setDifficulty(emptyProgress(), 'a-add-3digit', 'simple')
  const { progress, change } = adaptDifficulty(start, 'a-add-3digit', passed, clean('a-add-3digit', 47), MINIMUM)
  assert.equal(difficultyFor(progress, 'a-add-3digit'), 'medium')
  assert.equal(change?.direction, 'harder')
})

test('scraping through at the normal level does not push them higher', () => {
  const { progress } = adaptDifficulty(emptyProgress(), 'a-add-3digit', passed, clean('a-add-3digit', 47), MINIMUM)
  assert.equal(difficultyFor(progress, 'a-add-3digit'), 'medium',
    'climbing above the usual level is earned, not handed out')
})

test('running out of questions proves nothing', () => {
  const { progress } = adaptDifficulty(emptyProgress(), 'a-add-3digit', capped, struggled('a-add-3digit'), MINIMUM)
  assert.equal(provenAt(progress, 'a-add-3digit'), undefined)
})
