/**
 * What the placement quiz decided, said plainly.
 *
 * Observed with two real learners: both sat the quiz smoothly, and neither they
 * nor their parent could tell where it had put them — because it ended by
 * dropping them straight onto the topic map, leaving the result to be inferred
 * from where the ticks stop.
 *
 * That matters because placement is a single snapshot and "Change my level" is
 * the only correction. Nobody reaches for a correction they cannot tell is
 * needed.
 */

import { SKILL_BY_ID } from '@/lib/curriculum/skills'
import { unlockedSkills } from '@/lib/session/scheduler'
import { isSkillMastered, type Progress } from '@/lib/mastery/mastery'
import type { ImplementedSkill } from '@/lib/problems'

/** More than a handful is a wall of text nobody reads. */
const MOST_TOPICS_TO_NAME = 4

export type PlacementSummary = {
  /** Factual. Being placed at the beginning is not a failure, and being placed high is not a prize. */
  headline: string
  placedOut: number
  startingWith: { id: ImplementedSkill; label: string }[]
}

export function placementSummary(progress: Progress): PlacementSummary {
  const open = unlockedSkills(progress)

  // What they would actually begin with: open, but not already placed out of.
  const next = open
    .filter((id) => !isSkillMastered(progress, id))
    .map((id) => ({ id, skill: SKILL_BY_ID.get(id) }))
    .filter((entry): entry is { id: ImplementedSkill; skill: NonNullable<typeof entry.skill> } =>
      Boolean(entry.skill))
    .sort((a, b) => a.skill.typicalAge[0] - b.skill.typicalAge[0])
    .slice(0, MOST_TOPICS_TO_NAME)
    .map(({ id, skill }) => ({ id, label: skill.label }))

  const placedOut = progress.placed.length

  return {
    headline:
      placedOut === 0
        ? 'Starting from the beginning'
        : `${placedOut} ${placedOut === 1 ? 'topic' : 'topics'} already covered`,
    placedOut,
    // Someone who placed out of everything has nothing left to begin with, and
    // the screen says so rather than showing an empty list.
    startingWith: next,
  }
}
