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
import { nextSkill, unlockedSkills } from './scheduler'

/** Twenty problems, or roughly five minutes. Long enough to matter, short enough to finish. */
export const SESSION_LENGTH = 20

export type Session = {
  problems: Problem[]
  index: number
  attempts: Attempt[]
  progress: Progress
}

/** Attempts to find a fresh question before accepting a repeat. */
const VARIETY_TRIES = 25

/** Consecutive problems allowed from one skill before forcing a change. */
const MAX_RUN = 2

/**
 * The whole session is drawn up front so the child never waits, and so the
 * same seed replays the same set — a teacher can hand one session to a class.
 *
 * Drawing uniformly at random looked fine in tests and terrible in practice:
 * six number bonds in a row, and the same question twice in twenty. Both read
 * as a broken app, so variety is enforced on two axes — no repeated question,
 * and no more than `MAX_RUN` of one skill back to back.
 *
 * Both constraints yield rather than fail. `n-bonds-10` has only nine possible
 * questions, so a long enough session must be allowed to repeat instead of
 * hanging.
 */
export function startSession(progress: Progress, rng: Rng, length = SESSION_LENGTH): Session {
  const available = unlockedSkills(progress)
  const problems: Problem[] = []
  const asked = new Set<string>()

  for (let i = 0; i < length; i++) {
    // How many of the immediately preceding problems share a skill.
    const runLength = (skill: string) => {
      let n = 0
      while (n < problems.length && problems[problems.length - 1 - n].skill === skill) n++
      return n
    }

    let candidate = generate(nextSkill(progress, rng), rng)

    for (let attempt = 0; attempt < VARIETY_TRIES; attempt++) {
      const stale = asked.has(candidate.prompt)
      const overrun = available.length > 1 && runLength(candidate.skill) >= MAX_RUN
      if (!stale && !overrun) break
      candidate = generate(nextSkill(progress, rng), rng)
    }

    asked.add(candidate.prompt)
    problems.push(candidate)
  }

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
