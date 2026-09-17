/**
 * The level follows the outcome.
 *
 * This is the piece that ties the three rules together. A child is given their
 * weakest topic (weakest.ts) and has to reach 90% of the last twenty to be done
 * with the session (goal.ts), which is asked at one of three difficulties
 * (problems/difficulty.ts). What happens at the end of that session decides
 * which difficulty comes next:
 *
 *  - **Ran out of questions.** The level drops, so the next attempt is a fair
 *    fight rather than the same wall. This is deferral, not mercy: the topic is
 *    still their weakest, it still comes back, and it is not finished with
 *    until they have got it back up to where everyone else starts.
 *  - **Finished without needing a single extra question.** The level rises.
 *    Re-asking what they have just proved is a waste of the only twenty minutes
 *    anyone is going to give this.
 *  - **Anything in between.** Nothing moves. That is what the level they are on
 *    is for.
 *
 * The way out of a topic is to do it at the usual difficulty. Not to fail it
 * once and be quietly given something easier for ever.
 */

import type { Attempt, Difficulty, SkillId } from '@/lib/curriculum/types'
import { difficultyFor, easeOff, recordPass, stepUp } from '@/lib/mastery/levels'
import type { Progress } from '@/lib/mastery/mastery'
import { ACCURACY, type Goal } from './goal'

export type LevelChange = {
  skill: SkillId
  from: Difficulty
  to: Difficulty
  direction: 'easier' | 'harder'
}

export type Adaptation = { progress: Progress; change: LevelChange | null }

/**
 * Apply the end-of-session rule.
 *
 * `change` is null unless the level ACTUALLY moved — not merely whether a move
 * was called for. A topic already at the bottom has nothing below it, and a
 * topic with only one band (every fact topic) has nothing at all. Both cases
 * must not be announced: telling a child the work got easier and then handing
 * them the identical questions is worse than saying nothing, and it is the one
 * thing that would make the whole mechanism untrustworthy.
 *
 * Never mutates. Returns the progress to persist.
 */
export function adaptDifficulty(
  progress: Progress,
  skill: SkillId,
  goal: Goal,
  attempts: readonly Attempt[],
  minimum: number,
): Adaptation {
  // The level moves at the end of a session, not during one.
  if (!goal.over) return { progress, change: null }

  /**
   * Judged on THIS topic's answers, not the session's.
   *
   * Only about half a session is the topic in hand; the rest is interleaved
   * review and stretch. Scoring the move on all of it meant a child shaky at
   * three-digit addition but fluent at the review facts could clear 90% and be
   * pushed up on the very topic they were struggling with — and the reverse,
   * dropped on a topic they were fine at because the stretch went badly.
   */
  const own = attempts.filter((a) => a.skill === skill)
  const rate = own.length === 0 ? undefined : own.filter((a) => a.verdict === 'correct').length / own.length
  const heldUp = rate !== undefined && rate >= ACCURACY

  const from = difficultyFor(progress, skill)
  // What they have shown they can do, which the picker reads separately from
  // what they will be asked next.
  const after = goal.done && heldUp ? recordPass(progress, skill, from) : progress

  /**
   * "Clean" means the goal was met without buying a single extra question.
   *
   * A pass at `simple` restores the normal level however long it took, because
   * simple is a concession and passing it ends the concession. Requiring a
   * clean run to climb out would leave a child who scrapes through every time
   * stuck on the gentle version for ever — which is the trap this was supposed
   * to be the opposite of.
   */
  const answered = attempts.length
  const next = goal.reachedCap && rate !== undefined && !heldUp
    ? easeOff(after, skill)
    : goal.done && heldUp && (answered <= minimum || from === 'simple')
      ? stepUp(after, skill)
      : after

  const to = difficultyFor(next, skill)
  if (to === from) return { progress: next, change: null }

  return {
    progress: next,
    change: { skill, from, to, direction: goal.reachedCap ? 'easier' : 'harder' },
  }
}

/**
 * What to tell the learner.
 *
 * In terms of what the next session will feel like, not in the vocabulary this
 * code uses. "Dropped to simple" tells a child what the app did to them;
 * "these will start a bit gentler" tells them what to expect.
 */
export const levelNews = (change: LevelChange): string =>
  change.direction === 'easier'
    ? 'Next time these will start a bit gentler.'
    : 'You made that look easy — next time they get harder.'
