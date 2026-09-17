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
import { difficultyFor } from '@/lib/mastery/levels'
import { blockedBy, unlockedSkills } from './scheduler'

/** What a score at each level is worth against a score at full difficulty. */
const LEVEL_WORTH: Record<Difficulty, number> = { simple: 0.6, medium: 0.8, difficult: 1 }

export type PickReason =
  /** Practised, and not going well. */
  | 'struggling'
  /** Passed, but only after the level was dropped — the debt is still owed. */
  | 'climbing'
  /** Unlocked and never met. */
  | 'new'
  /** Something underneath has rotted; drilling the top would not help. */
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
  const worth = isVaried(skill) ? LEVEL_WORTH[difficultyFor(progress, skill)] : 1
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
 * Mastered is not enough on its own. A topic sitting at `simple` is there
 * because the learner hit the session cap on it and the level was dropped to
 * give them a way through — so passing it at that level clears the session, not
 * the topic. The drop is a debt to be repaid, not a new baseline, and a topic
 * still carrying one keeps coming back.
 *
 * Getting back to `medium` settles it. Going on to `difficult` is worth more in
 * the ordering below, but it is not a toll every topic has to pay: grinding all
 * fifty-four to the hardest band before meeting anything new would be a
 * punishment, not a curriculum.
 */
const isSettled = (progress: Progress, skill: ImplementedSkill): boolean =>
  isSkillMastered(progress, skill)
  && (!isVaried(skill) || difficultyFor(progress, skill) !== 'simple')

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
    return foundationOr(
      progress,
      unfinished,
      isSkillMastered(progress, unfinished) ? 'climbing' : 'struggling',
    )
  }

  /**
   * Unmastered AND unmet. A skill they placed out of is not new to them, and
   * offering it as though it were would send a thirteen-year-old back to
   * number bonds on the strength of it being first in the list.
   */
  const fresh = unlocked.find(
    (id) => skillProgress(progress, id) === undefined && !isSkillMastered(progress, id),
  )
  if (fresh) return foundationOr(progress, fresh, 'new')

  return foundationOr(progress, [...unlocked].sort(weakestFirst(progress))[0], 'polish')
}

/**
 * Send them to what this stands on, if that has rotted underneath it.
 *
 * Practice can overturn a placement, so a prerequisite can regress after the
 * thing above it was unlocked. Drilling the top of a stack whose bottom has
 * gone is the one choice guaranteed not to help — and `blockedBy` gives the
 * immediate prerequisite rather than the deepest one, so they are sent one step
 * down rather than all the way to the beginning.
 */
function foundationOr(progress: Progress, skill: ImplementedSkill, reason: PickReason): Pick {
  const missing = blockedBy(progress, skill)
  if (missing.length === 0) return { skill, reason }
  return { skill: [...missing].sort(weakestFirst(progress))[0], reason: 'foundation' }
}

/** For naming the topic to the learner without repeating the pick logic. */
export const topicIsA = (reason: PickReason): string =>
  reason === 'struggling' ? 'This one needs work'
    : reason === 'climbing' ? 'Back up to full strength'
      : reason === 'new' ? 'Something new'
        : reason === 'foundation' ? 'This holds up what you were doing'
          : 'Taking this one further'
