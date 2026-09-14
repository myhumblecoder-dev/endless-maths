/**
 * Working out what is actually going wrong.
 *
 * A learner failing two-step equations usually does not have a two-step
 * equation problem — they have a negative numbers problem, two levels down.
 * Grinding the skill they are failing is the worst possible response.
 *
 * This is the most valuable personalization in the product and it involves no
 * model at all: it is a walk backwards through the prerequisite DAG.
 */

import type { SkillId } from '@/lib/curriculum/types'
import { findGaps } from '@/lib/curriculum/skills'
import { GENERATORS, type ImplementedSkill } from '@/lib/problems'
import { isSkillMastered, skillCorrectRate, type Progress } from '@/lib/mastery/mastery'

/**
 * Attempts before a low success rate means anything. Below this it is noise —
 * and interrupting someone who has simply had a bad couple of questions is
 * both wrong and irritating.
 */
export const STRUGGLE_ATTEMPTS = 6

/** Trailing success rate below which a skill counts as not going well. */
export const STRUGGLE_RATE = 0.5

export function isStruggling(progress: Progress, skill: SkillId): boolean {
  const state = progress.skills[skill]
  if (!state || state.attempts < STRUGGLE_ATTEMPTS) return false
  return skillCorrectRate(progress, skill) < STRUGGLE_RATE
}

/**
 * The skill worth going back to, or `undefined` when there is nothing beneath
 * them that is missing — in which case the honest answer is that this skill is
 * simply hard, and they should keep practising it.
 *
 * `findGaps` returns prerequisites deepest-first, so the first buildable one is
 * the foundation to repair rather than a symptom nearer the surface.
 */
export function gapBehind(progress: Progress, skill: SkillId): ImplementedSkill | undefined {
  if (!isStruggling(progress, skill)) return undefined

  return findGaps(skill, (id) => isSkillMastered(progress, id))
    .find((id): id is ImplementedSkill => id in GENERATORS)
}
