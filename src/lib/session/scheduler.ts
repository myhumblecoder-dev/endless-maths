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

/**
 * What stands between the learner and this skill: the immediate prerequisites
 * not yet mastered, in curriculum order.
 *
 * Immediate, not transitive. Being told "you need number bonds" when you are
 * looking at two-step equations is true and useless — the next step is what is
 * actionable, and each blocker's own row explains itself in turn.
 *
 * Uses the same `effectivePrereqs` walk that decides the lock, so the
 * explanation can never disagree with the lock, and nobody is sent to practise
 * a skill that does not exist.
 */
export function blockedBy(progress: Progress, skill: SkillId): ImplementedSkill[] {
  // Nothing blocks a skill the learner has already mastered.
  if (isSkillMastered(progress, skill)) return []
  return effectivePrereqs(skill).filter((req) => !isSkillMastered(progress, req))
}

/** Skills the learner has earned the right to meet. */
export function unlockedSkills(progress: Progress): ImplementedSkill[] {
  return (Object.keys(GENERATORS) as ImplementedSkill[]).filter(
    (id) =>
      // Taking away a skill they have already demonstrated would be absurd —
      // reachable once practice could overturn a placement, because then a
      // prerequisite can regress underneath something already mastered.
      isSkillMastered(progress, id) ||
      effectivePrereqs(id).every((req) => isSkillMastered(progress, req)),
  )
}

/**
 * Leitner intervals. A missed fact returns at once; a known one rests longer
 * each time it survives. Deliberately short at the top — this is practice
 * within a week, not a year-long retention schedule.
 */
const INTERVALS_MS = [0, 30_000, 5 * 60_000, 45 * 60_000, 24 * 3_600_000, 7 * 24 * 3_600_000]

/**
 * Facts due for review, weakest first.
 *
 * Weakness is the Leitner box, then how long it has been waiting — a fact just
 * answered wrong sits in box 0 and comes back at the front of the queue.
 */
export function weakestDueFirst(progress: Progress, now: number): string[] {
  return dueFacts(progress, now).sort((a, b) => {
    const fa = progress.facts[a]
    const fb = progress.facts[b]
    return fa.box - fb.box || fa.lastSeenAt - fb.lastSeenAt
  })
}

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
