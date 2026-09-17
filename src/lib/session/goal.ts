/**
 * When a session is finished.
 *
 * Not "after twenty questions". A session ends when the learner is getting
 * them right — 90% of the last twenty — so wrong answers lengthen the run and
 * improving shortens it. The child's way out is to get better at it, which is
 * the only honest version of "practice until you can do it".
 *
 * ## Why a rolling window rather than a cumulative one
 *
 * Cumulative 90% requires `total >= 10 * wrong`. Below 90% accuracy the finish
 * line therefore recedes faster than the learner approaches it — it is
 * unreachable as a matter of arithmetic, not merely hard. Simulated at 80%
 * accuracy, three sessions in four never terminate at all.
 *
 * Since the session picker deliberately hands a child their WEAKEST topic, a
 * cumulative rule would trap precisely the learner it was built for. The
 * rolling window bounds the cost of a mistake: a wrong answer costs work until
 * it falls out of the last twenty, and then it costs nothing.
 *
 * ## Why there is still a cap
 *
 * At 70% accuracy the window rule alone runs long. The cap is not mercy and is
 * not a pass — it is a deferral. The topic stays their weakest and comes back,
 * one level easier; see mastery/levels.ts and docs/design.md.
 *
 * Simulated cost of a bad day:
 *
 * | accuracy | questions | time    |
 * | -------- | --------- | ------- |
 * | 95%      | 20        | ~3 min  |
 * | 85%      | 24        | ~3 min  |
 * | 80%      | 38        | ~5 min  |
 * | 70%      | 60 capped | ~8 min  |
 */

/** How many recent answers the rule looks at. */
export const SESSION_WINDOW = 20

/** The share of that window that has to be right. */
export const ACCURACY = 0.9

/** Nobody answers more than this, however the session is going. */
export const SESSION_CAP = 60

export type Goal = {
  /** How many of the recent answers count toward the rule. */
  window: number
  /** How many of those were right. */
  right: number
  /** How many of them need to be. */
  required: number
  /**
   * The fewest further questions that could finish the session — what the
   * learner is shown. Zero once they are done.
   */
  remaining: number
  /** The goal has been met: they may stop, and it counts as a pass. */
  done: boolean
  /** They ran out of questions rather than out of mistakes. */
  reachedCap: boolean
  /** No more questions, either way. */
  over: boolean
}

/**
 * `verdicts[i]` is whether answer `i` was right, oldest first.
 *
 * `minimum` is the shortest the session may be — the learner's chosen length.
 * The rule scales to it, so a ten-question run needs nine of the last ten.
 */
export function goalOf(verdicts: readonly boolean[], minimum = SESSION_WINDOW): Goal {
  const answered = verdicts.length
  const cap = Math.max(SESSION_CAP, minimum)

  /**
   * A ten-question session is judged on its last ten, not on a twenty-answer
   * window it would never fill. The window is fixed by the session's length,
   * not by how far into it the learner has got — a window that grows as they
   * answer would raise the bar every time they cleared it.
   */
  const full = Math.min(minimum, SESSION_WINDOW)
  const window = Math.min(answered, full)
  const right = verdicts.slice(answered - window).filter(Boolean).length
  const required = Math.ceil(window * ACCURACY)

  /**
   * Whether `k` further right answers would finish it.
   *
   * Stated as the rule itself rather than as arithmetic about where the
   * mistakes are. The clever version hard-coded the twenty-answer allowance
   * while `required` scaled with the window in force, so a ten-question
   * session with two wrong reported nothing left to do while still running —
   * the counter read `11 / 10`, then `12 / 11`. The definition cannot drift
   * from itself.
   */
  const finishedAfter = (k: number): boolean => {
    const total = answered + k
    if (total < minimum) return false
    const w = Math.min(total, full)
    const kept = Math.max(0, w - k) // how much of the existing run is still in view
    const carried = verdicts.slice(answered - kept).filter(Boolean).length
    return Math.min(k, w) + carried >= Math.ceil(w * ACCURACY)
  }

  const done = finishedAfter(0)
  const reachedCap = !done && answered >= cap

  // Never promise more questions than the session is allowed to ask. If no
  // number of right answers finishes it, the cap is the answer.
  let remaining = cap - answered
  for (let k = 0; k <= cap - answered; k++) {
    if (!finishedAfter(k)) continue
    remaining = k
    break
  }

  return { window, right, required, remaining, done, reachedCap, over: done || reachedCap }
}
