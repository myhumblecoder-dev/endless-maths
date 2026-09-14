/**
 * One bounded run of problems.
 *
 * The supply is endless; a session is not. A child needs a finish line — see
 * docs/design.md § Endless supply, bounded sessions.
 */

import type { Attempt, Problem, Rng } from '@/lib/curriculum/types'
import { generate } from '@/lib/problems'
import { check } from '@/lib/problems/check'
import { record, type Progress } from '@/lib/mastery/mastery'
import { nextSkill } from './scheduler'

/** Twenty problems, or roughly five minutes. Long enough to matter, short enough to finish. */
export const SESSION_LENGTH = 20

export type Session = {
  problems: Problem[]
  index: number
  attempts: Attempt[]
  progress: Progress
}

/**
 * The whole session is drawn up front so the child never waits, and so the
 * same seed replays the same set — a teacher can hand one session to a class.
 */
export function startSession(progress: Progress, rng: Rng, length = SESSION_LENGTH): Session {
  const problems = Array.from({ length }, () => generate(nextSkill(progress, rng), rng))
  return { problems, index: 0, attempts: [], progress }
}

export const currentProblem = (s: Session): Problem | undefined => s.problems[s.index]

export const isComplete = (s: Session): boolean => s.index >= s.problems.length

/** Returns a new session; never mutates. */
export function answer(s: Session, given: string, elapsedMs: number, at: number): Session {
  const problem = currentProblem(s)
  if (!problem) return s

  const attempt: Attempt = {
    problemId: problem.id,
    skill: problem.skill,
    factKey: problem.factKey,
    given,
    verdict: check(problem.answer, given),
    elapsedMs,
    at,
  }

  return {
    ...s,
    index: s.index + 1,
    attempts: [...s.attempts, attempt],
    progress: record(s.progress, attempt),
  }
}

export function summary(s: Session) {
  return {
    answered: s.attempts.length,
    correct: s.attempts.filter((a) => a.verdict === 'correct').length,
    total: s.problems.length,
  }
}
