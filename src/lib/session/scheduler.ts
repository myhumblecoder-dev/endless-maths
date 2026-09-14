/**
 * What to practise next. See docs/design.md § Facts vs procedures.
 *
 * Pure and synchronous: scheduling is arithmetic over local state, so it runs
 * in the browser with no server and no model call.
 */

import type { Rng, SkillId } from '@/lib/curriculum/types'
import { SKILL_BY_ID } from '@/lib/curriculum/skills'
import { GENERATORS, type ImplementedSkill } from '@/lib/problems'
import { isSkillMastered, type Progress } from '@/lib/mastery/mastery'

const isImplemented = (id: SkillId): id is ImplementedSkill => id in GENERATORS

/**
 * Direct prerequisites, with unbuilt skills replaced by THEIR prerequisites.
 *
 * Stepping over an unbuilt node rather than dropping it is what keeps the
 * gating honest. `n-count-20` is unbuilt and a genuine root, so number bonds
 * really are available on day one. `r-factors-multiples` is also unbuilt but
 * sits behind division — drop it instead of stepping over it and a five-year-old
 * gets asked whether 23 is prime.
 */
function effectivePrereqs(id: SkillId, seen = new Set<SkillId>()): ImplementedSkill[] {
  const skill = SKILL_BY_ID.get(id)
  if (!skill || seen.has(id)) return []
  seen.add(id)

  return skill.requires.flatMap((req) =>
    isImplemented(req) ? [req] : effectivePrereqs(req, seen),
  )
}

/** Skills the learner has earned the right to meet. */
export function unlockedSkills(progress: Progress): ImplementedSkill[] {
  return (Object.keys(GENERATORS) as ImplementedSkill[]).filter((id) =>
    effectivePrereqs(id).every((req) => isSkillMastered(progress, req)),
  )
}

/**
 * Leitner intervals. A missed fact returns at once; a known one rests longer
 * each time it survives. Deliberately short at the top — this is practice
 * within a week, not a year-long retention schedule.
 */
const INTERVALS_MS = [0, 30_000, 5 * 60_000, 45 * 60_000, 24 * 3_600_000, 7 * 24 * 3_600_000]

export function dueFacts(progress: Progress, now: number): string[] {
  return Object.values(progress.facts)
    .filter((f) => {
      const wait = INTERVALS_MS[Math.min(f.box, INTERVALS_MS.length - 1)]
      return now - f.lastSeenAt >= wait
    })
    .map((f) => f.factKey)
}

/**
 * Pick the next skill: unmastered work first, and only fall back to mastered
 * skills when there is nothing left to learn — a child who has finished
 * everything available still gets to practise rather than hitting a dead end.
 */
export function nextSkill(progress: Progress, rng: Rng): ImplementedSkill {
  const unlocked = unlockedSkills(progress)
  const unmastered = unlocked.filter((id) => !isSkillMastered(progress, id))
  const pool = unmastered.length > 0 ? unmastered : unlocked
  return pool[Math.floor(rng() * pool.length)]
}
