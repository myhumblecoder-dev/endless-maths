/**
 * What the learner knows. See docs/design.md § Facts vs procedures.
 *
 * Pure functions over a plain object so the whole thing serializes to
 * localStorage and never reaches a server — the users are children, and data
 * that never leaves the device cannot trigger COPPA.
 */

import type { Attempt, FactState, SkillId, SkillState } from '@/lib/curriculum/types'

/**
 * A fact answered more slowly than this was worked out, not recalled. Three
 * seconds is the usual line for times-table fluency.
 *
 * This threshold is applied to FACTS ONLY. Applying it to a procedure would
 * punish a child for doing careful working, which is the opposite of the goal.
 */
export const FLUENCY_MS = 3000

/** Consecutive correct answers before a fact counts as known. */
export const MASTERY_BOX = 3

/** How many response times to keep. Odd, so the median is a real sample. */
const MS_WINDOW = 5

/** Trailing verdicts kept per skill. */
const VERDICT_WINDOW = 10

/** Below this many attempts, a success rate is noise. */
export const MIN_PROCEDURE_ATTEMPTS = 8

export const PROCEDURE_MASTERY_RATE = 0.85

export type Progress = {
  facts: Record<string, FactState>
  skills: Partial<Record<SkillId, SkillState>>
  /**
   * Skills the placement quiz established are already known. Kept apart from
   * `skills` because being placed out of something is not the same as having
   * practised it — and only practice produces the fact-level fluency data.
   */
  placed: SkillId[]
  /**
   * Distinct from `placed` being empty — a genuine beginner places out of
   * nothing, and must not be handed the quiz again every time they open the app.
   */
  placementDone: boolean
}

export const emptyProgress = (): Progress => ({
  facts: {}, skills: {}, placed: [], placementDone: false,
})

const push = <T>(xs: T[], x: T, max: number): T[] => [...xs, x].slice(-max)

/** Returns new progress; never mutates its argument. */
export function record(progress: Progress, attempt: Attempt): Progress {
  const correct = attempt.verdict === 'correct'

  const skills = { ...progress.skills }
  const prevSkill = skills[attempt.skill]
  skills[attempt.skill] = {
    skill: attempt.skill,
    attempts: (prevSkill?.attempts ?? 0) + 1,
    recent: push(prevSkill?.recent ?? [], correct, VERDICT_WINDOW),
    lastSeenAt: attempt.at,
  }

  const facts = { ...progress.facts }
  if (attempt.factKey) {
    const prev = facts[attempt.factKey]
    facts[attempt.factKey] = {
      factKey: attempt.factKey,
      skill: attempt.skill,
      // One wrong answer sends it back to the start — that is the Leitner rule,
      // and it is what stops a half-known fact drifting out of rotation.
      box: correct ? (prev?.box ?? 0) + 1 : 0,
      seen: (prev?.seen ?? 0) + 1,
      correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
      recentMs: push(prev?.recentMs ?? [], attempt.elapsedMs, MS_WINDOW),
      lastSeenAt: attempt.at,
    }
  }

  return { ...progress, facts, skills }
}

export function factMedianMs(state: FactState): number {
  if (state.recentMs.length === 0) return Infinity
  const sorted = [...state.recentMs].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Correct AND fast. Either alone is not fluency. */
export function isFactMastered(state: FactState): boolean {
  return state.box >= MASTERY_BOX && factMedianMs(state) <= FLUENCY_MS
}

export function skillCorrectRate(progress: Progress, skill: SkillId): number {
  const s = progress.skills[skill]
  if (!s || s.recent.length === 0) return 0
  return s.recent.filter(Boolean).length / s.recent.length
}

/**
 * Accuracy over a trailing window. Deliberately says nothing about speed.
 *
 * Placement is a claim; practice is evidence. Until there is enough practice
 * the claim stands, and after that the evidence wins — otherwise a skill
 * someone placed out of stays ticked "done" while they get 30% of it wrong.
 */
export function isSkillMastered(progress: Progress, skill: SkillId): boolean {
  const s = progress.skills[skill]
  const enoughEvidence = s !== undefined && s.attempts >= MIN_PROCEDURE_ATTEMPTS

  if (!enoughEvidence) return progress.placed.includes(skill)
  return skillCorrectRate(progress, skill) >= PROCEDURE_MASTERY_RATE
}

/** Enough answers for a trend to mean anything rather than be noise. */
const TREND_MINIMUM = 6

/** How much the two halves must differ before it counts as movement. */
const TREND_THRESHOLD = 0.2

export type SkillProgress = {
  attempts: number
  /** Over the trailing window, not all time. */
  accuracy: number
  trend: 'up' | 'down' | 'steady' | 'unknown'
}

/**
 * What to show a learner about a skill.
 *
 * A lifetime average hides exactly what they want to know: someone who was at
 * 40% and is now at 90% deserves to see that, not a flat 65%. The trend
 * compares the two halves of the trailing window, and refuses to claim one at
 * all from too few answers.
 */
export function skillProgress(progress: Progress, skill: SkillId): SkillProgress | undefined {
  const state = progress.skills[skill]
  if (!state || state.attempts === 0) return undefined

  const { recent } = state
  const accuracy = recent.length === 0 ? 0 : recent.filter(Boolean).length / recent.length

  if (recent.length < TREND_MINIMUM) {
    return { attempts: state.attempts, accuracy, trend: 'unknown' }
  }

  const half = Math.floor(recent.length / 2)
  const rate = (slice: boolean[]) => slice.filter(Boolean).length / slice.length
  const change = rate(recent.slice(half)) - rate(recent.slice(0, half))

  const trend =
    change > TREND_THRESHOLD ? 'up' : change < -TREND_THRESHOLD ? 'down' : 'steady'

  return { attempts: state.attempts, accuracy, trend }
}
