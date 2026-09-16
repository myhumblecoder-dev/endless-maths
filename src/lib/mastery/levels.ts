/**
 * Which level each topic is asked at, for this one child.
 *
 * Lives in `Progress` rather than anywhere global, because it is a fact about
 * a learner and not about the maths: Eddie can be on simple three-digit
 * addition while Ethan is on difficult, and neither should be able to see the
 * other's. The per-profile storage key already gives that for free.
 *
 * The rules that move it are in session/adaptive.ts — this module only knows
 * how to read, write and step a level.
 */

import type { Difficulty, SkillId } from '@/lib/curriculum/types'
import { DEFAULT_DIFFICULTY, DIFFICULTIES, easier, harder, isVaried } from '@/lib/problems/difficulty'
import type { Progress } from './mastery'

const known = (v: unknown): v is Difficulty =>
  typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v)

/**
 * A stored level is only honoured if it is one of the three and the topic
 * actually varies. Anything else reads as `medium`, which is what every topic
 * did before levels existed.
 */
export function difficultyFor(progress: Progress, skill: SkillId): Difficulty {
  if (!isVaried(skill)) return DEFAULT_DIFFICULTY
  const stored = progress.levels?.[skill]
  return known(stored) ? stored : DEFAULT_DIFFICULTY
}

export function setDifficulty(progress: Progress, skill: SkillId, level: Difficulty): Progress {
  // A topic with one band would be told it had been made easier and then handed
  // the same questions, which is worse than saying nothing at all.
  if (!isVaried(skill)) return progress
  if (difficultyFor(progress, skill) === level) return progress
  return { ...progress, levels: { ...progress.levels, [skill]: level } }
}

/** After hitting the question cap: give them a way through the same topic. */
export const easeOff = (progress: Progress, skill: SkillId): Progress =>
  setDifficulty(progress, skill, easier(difficultyFor(progress, skill)))

/** After a clean run: there is no point re-asking what they have just proved. */
export const stepUp = (progress: Progress, skill: SkillId): Progress =>
  setDifficulty(progress, skill, harder(difficultyFor(progress, skill)))
