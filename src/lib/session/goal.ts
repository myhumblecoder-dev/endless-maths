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

  const window = Math.min(answered, SESSION_WINDOW)
  const recent = verdicts.slice(answered - window)
  const right = recent.filter(Boolean).length
  const required = Math.ceil(window * ACCURACY)

  /**
   * The soonest this could end.
   *
   * A wrong answer stops mattering once it drops out of the window, so the work
   * left is set by WHERE the mistakes are, not how many there have been. With
   * mistakes at positions p (1 = most recent) and `allowed` of them tolerated,
   * the session can end as soon as every mistake beyond the allowance has aged
   * out: `SESSION_WINDOW + 1 - p` further right answers, for the oldest one
   * that still has to go.
   */
  const allowed = SESSION_WINDOW - Math.ceil(SESSION_WINDOW * ACCURACY)
  const mistakes = verdicts
    .slice(Math.max(0, answered - SESSION_WINDOW))
    .flatMap((ok, i, xs) => (ok ? [] : [xs.length - i])) // position from the end, 1-based
  const mustAgeOut = mistakes[mistakes.length - 1 - allowed]
  const toFlush = mustAgeOut === undefined ? 0 : SESSION_WINDOW + 1 - mustAgeOut

  const done = answered >= minimum && window >= Math.min(minimum, SESSION_WINDOW) && right >= required
  const reachedCap = !done && answered >= cap

  return {
    window,
    right,
    required,
    // Never promise more questions than the session is allowed to ask.
    remaining: done ? 0 : Math.min(Math.max(toFlush, minimum - answered), cap - answered),
    done,
    reachedCap,
    over: done || reachedCap,
  }
}
