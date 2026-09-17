/**
 * Which topic to practise. The child does not choose.
 *
 * Given a list to pick from, a learner picks what they are good at — which is
 * the one thing practice cannot improve. So the app picks, and it picks their
 * weakest.
 *
 * ## Weakness counts the level, not just the score
 *
 * A topic can be asked at three difficulties, and hitting the session cap drops
 * the level so the next attempt is a fair fight (see mastery/levels.ts). That
 * drop has to be a way THROUGH the topic, not a way out of it: if 95% of the
 * simple version scored the same as 95% of the hard one, a child could escape
 * anything simply by failing it once. So a score is scaled by the level it was
 * earned at, and a topic sitting at `simple` is not finished with until they
 * have got it back to the level everyone else starts on.
 *
 * Topics with no levels — the fact topics — are not scaled. A times table is a
 * hundred facts each scheduled on its own, not an easy version of something;
 * scoring it as though it were stuck on "medium" would pin it permanently below
 * anything that can be taken to difficult, and the child would never leave it.
 */

import type { Difficulty } from '@/lib/curriculum/types'
import { isVaried, type ImplementedSkill } from '@/lib/problems'
import { isSkillMastered, skillProgress, type Progress } from '@/lib/mastery/mastery'
import { difficultyFor, provenAt } from '@/lib/mastery/levels'
import { unlockedSkills } from './scheduler'

/** What a score at each level is worth against a score at full difficulty. */
const LEVEL_WORTH: Record<Difficulty, number> = { simple: 0.6, medium: 0.8, difficult: 1 }

export type PickReason =
  /** Practised, and not going well. */
  | 'struggling'
  /** Passed, but only after the level was dropped — the debt is still owed. */
  | 'climbing'
  /** Unlocked and never met. */
  | 'new'
  /**
   * Sent to what something else stands on. Not produced by `pickTopic`:
   * `unlockedSkills` already refuses any skill whose prerequisites are not
   * mastered, so nothing it offers can be standing on a gap. A prerequisite
   * that rots simply becomes the weakest practised topic and is picked as
   * `struggling`. This is for the end-of-session suggestion, which is offered
   * rather than chosen — see diagnose.ts.
   */
  | 'foundation'
  /** Nothing is failing, so take the least-proven one further. */
  | 'polish'

export type Pick = { skill: ImplementedSkill; reason: PickReason }

/**
 * How thoroughly this topic has been beaten, from 0 to 1.
 *
 * Accuracy scaled by the level it was earned at. A topic never practised scores
 * on its placement instead: claimed but unproven, which is worth less than the
 * same claim demonstrated.
 */
export function strengthOf(progress: Progress, skill: ImplementedSkill): number {
  /**
   * The level they were PROVED at where there is one, falling back to the level
   * queued next where there is not.
   *
   * Using the queued level alone made a topic jump from 0.6x to 0.8x the moment
   * a simple pass stepped it up to medium — crediting a level before a single
   * question had been answered there, which is the same before-the-evidence
   * accounting `isSettled` reads `provenAt` to avoid.
   */
  const level = provenAt(progress, skill) ?? difficultyFor(progress, skill)
  const worth = isVaried(skill) ? LEVEL_WORTH[level] : 1
  const seen = skillProgress(progress, skill)
  const accuracy = seen ? seen.accuracy : isSkillMastered(progress, skill) ? 1 : 0
  return worth * accuracy
}

/** In curriculum order, which is roughly the order they are learned. */
const weakestFirst = (progress: Progress) => (a: ImplementedSkill, b: ImplementedSkill) =>
  strengthOf(progress, a) - strengthOf(progress, b)

/**
 * Done with, for now.
 *
 * Mastered is not enough on its own. A topic is dropped to `simple` because the
 * learner ran out of questions on it, and beating the concession clears the
 * session rather than the topic.
 *
 * The test is what they have PROVED, not what they are queued to be asked next.
 * Those differ by exactly one session: passing the simple version steps the
 * level back up to medium, and reading the queued level would have counted that
 * as having done it at medium before they had answered a single question there.
 * That is the escape hatch this whole mechanism exists to close.
 *
 * A topic with no `proven` entry is settled on mastery alone — placement, and
 * every record written before levels existed, is taken at face value rather
 * than treated as suspect.
 */
const isSettled = (progress: Progress, skill: ImplementedSkill): boolean =>
  isSkillMastered(progress, skill)
  && (!isVaried(skill) || provenAt(progress, skill) !== 'simple')

/**
 * The topic to practise now.
 *
 * Three tiers, in order, because they are three different needs and folding
 * them into a single score gets all three wrong:
 *
 *  1. Unfinished business — practised and either still going wrong, or passed
 *     only after the level was dropped. Weakest of those first.
 *  2. Something they have never met — ordinary progress through the graph.
 *  3. The least-proven of what is left, once nothing is outstanding. This is
 *     where a topic at `difficult` finally outranks one at `medium`.
 *
 * Pure and deterministic: no clock, no rng. The same state always gives the
 * same topic, so "your weakest topic" does not change because they blinked.
 */
export function pickTopic(progress: Progress): Pick {
  const unlocked = unlockedSkills(progress)
  // Defensive: the graph always has a root, but a picker that can return
  // nothing would hand a child a blank screen.
  if (unlocked.length === 0) return { skill: 'n-bonds-10', reason: 'new' }

  const practised = unlocked.filter((id) => skillProgress(progress, id) !== undefined)

  const unfinished = practised
    .filter((id) => !isSettled(progress, id))
    .sort(weakestFirst(progress))[0]
  if (unfinished) {
    return {
      skill: unfinished,
      reason: isSkillMastered(progress, unfinished) ? 'climbing' : 'struggling',
    }
  }

  /**
   * Unmastered AND unmet. A skill they placed out of is not new to them, and
   * offering it as though it were would send a thirteen-year-old back to
   * number bonds on the strength of it being first in the list.
   */
  const fresh = unlocked.find(
    (id) => skillProgress(progress, id) === undefined && !isSkillMastered(progress, id),
  )
  if (fresh) return { skill: fresh, reason: 'new' }

  return { skill: [...unlocked].sort(weakestFirst(progress))[0], reason: 'polish' }
}

/** For naming the topic to the learner without repeating the pick logic. */
export const topicIsA = (reason: PickReason): string =>
  reason === 'struggling' ? 'This one needs work'
    : reason === 'climbing' ? 'Back up to full strength'
      : reason === 'new' ? 'Something new'
        : reason === 'foundation' ? 'This holds up what you were doing'
          : 'Taking this one further'
