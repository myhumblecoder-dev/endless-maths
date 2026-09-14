import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  startPlacement, currentProbe, answerProbe, isPlacementComplete,
  placementToProgress, MAX_PROBES, strandLadder,
} from './placement'
import { unlockedSkills } from '@/lib/session/scheduler'
import { emptyProgress, isSkillMastered } from '@/lib/mastery/mastery'
import { seeded } from '@/lib/problems'
import type { ImplementedSkill } from '@/lib/problems'

/**
 * Run the whole quiz against a simulated learner who can do exactly the skills
 * `knows` returns true for.
 */
function sit(knows: (skill: ImplementedSkill) => boolean, seed = 42) {
  const rng = seeded(seed)
  let p = startPlacement(rng)
  let asked = 0
  while (!isPlacementComplete(p)) {
    const probe = currentProbe(p)
    assert.ok(probe, 'an incomplete placement must have a probe')
    p = answerProbe(p, knows(probe.skill as ImplementedSkill), rng)
    asked++
    assert.ok(asked <= 100, 'placement failed to terminate')
  }
  return { placement: p, asked }
}

const ALL = () => true
const NONE = () => false

test('the ladder covers every strand, easiest first', () => {
  const ladder = strandLadder()
  assert.ok(ladder.length >= 5, 'every implemented strand should be probed')
  for (const [, skills] of ladder) {
    assert.ok(skills.length > 0)
    const ages = skills.map((s) => s.typicalAge[0])
    assert.deepEqual(ages, [...ages].sort((a, b) => a - b), 'each strand must run easy to hard')
  }
})

test('placement terminates and stays short enough for a child', () => {
  assert.ok(sit(ALL).asked <= MAX_PROBES, 'a strong learner sat too many questions')
  assert.ok(sit(NONE).asked <= MAX_PROBES, 'a struggling learner sat too many questions')
})

test('a learner who gets nothing right is placed at the very start', () => {
  const { placement } = sit(NONE)
  const progress = placementToProgress(placement)
  const unlocked = unlockedSkills(progress)
  assert.ok(unlocked.includes('n-bonds-10'), 'the beginning is still available')
  assert.ok(!unlocked.includes('m-times-6-7-8-9'), 'nothing was demonstrated, nothing is unlocked')
})

test('a learner who gets everything right reaches pre-algebra', () => {
  const { placement } = sit(ALL)
  const progress = placementToProgress(placement)
  const unlocked = unlockedSkills(progress)
  assert.ok(unlocked.includes('p-solve-two-step'), 'a strong learner must not be stuck on number bonds')
  assert.ok(unlocked.includes('m-times-6-7-8-9'))
})

/** The case that started all this: a ten-year-old should not meet number bonds. */
test('a mid-range learner lands mid-range', () => {
  const knows = (skill: ImplementedSkill) =>
    skill.startsWith('n-') || skill.startsWith('a-') || skill.startsWith('m-times') || skill.startsWith('m-div')
  const { placement } = sit(knows)
  const progress = placementToProgress(placement)

  assert.ok(isSkillMastered(progress, 'm-times-2-5-10'), 'demonstrated tables should be placed out of')
  assert.ok(!isSkillMastered(progress, 'p-solve-two-step'), 'undemonstrated pre-algebra should not be')
  assert.ok(unlockedSkills(progress).includes('m-times-6-7-8-9'))
})

test('placement is reproducible from its seed', () => {
  const a = sit(ALL, 7).placement
  const b = sit(ALL, 7).placement
  assert.deepEqual(placementToProgress(a), placementToProgress(b))
})

test('a completed placement has no probe left', () => {
  assert.equal(currentProbe(sit(ALL).placement), undefined)
})

test('a beginner who places out of nothing is not asked to sit it again', () => {
  const progress = placementToProgress(sit(NONE).placement)
  assert.equal(progress.placed.length, 0, 'nothing was demonstrated')
  assert.equal(progress.placementDone, true, 'but the quiz was still taken')
})

test('a fresh learner has not taken it', () => {
  assert.equal(emptyProgress().placementDone, false)
})
