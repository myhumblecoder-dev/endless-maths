/**
 * The placement quiz.
 *
 * Without it the skill graph is a wall: every learner starts at number bonds
 * and must grind three infant skills before anything else unlocks. The quiz
 * samples across every strand and places the learner where they actually are.
 *
 * Per strand it runs easiest → hardest → binary search. The easiest-first
 * short-circuit matters: a struggling child bails out of a strand after one
 * question rather than sitting through a run of failures.
 */

import type { Problem, Rng, Skill, SkillId, Strand } from '@/lib/curriculum/types'
import { SKILLS } from '@/lib/curriculum/skills'
import { GENERATORS, generate, type ImplementedSkill } from '@/lib/problems'
import { emptyProgress, type Progress } from '@/lib/mastery/mastery'

/** Worst case across all strands. A one-time quiz, roughly one session long. */
export const MAX_PROBES = 24

const STRAND_ORDER: Strand[] = [
  'number-sense', 'add-sub', 'mul-div', 'fractions', 'ratio-negatives', 'pre-algebra',
]

/** Implemented skills per strand, easiest first. */
export function strandLadder(): [Strand, Skill[]][] {
  return STRAND_ORDER.map((strand) => [
    strand,
    SKILLS.filter((s) => s.strand === strand && s.id in GENERATORS)
      .sort((a, b) => a.typicalAge[0] - b.typicalAge[0] || a.typicalAge[1] - b.typicalAge[1]),
  ] as [Strand, Skill[]]).filter(([, skills]) => skills.length > 0)
}

type Phase = 'easiest' | 'hardest' | 'search'

export type Placement = {
  ladder: [Strand, Skill[]][]
  strandIndex: number
  phase: Phase
  lo: number
  hi: number
  best: number
  probe?: Problem
  placed: SkillId[]
  asked: number
}

const skillsAt = (p: Placement): Skill[] => p.ladder[p.strandIndex]?.[1] ?? []

const probeAt = (p: Placement, index: number, rng: Rng): Problem =>
  generate(skillsAt(p)[index].id as ImplementedSkill, rng)

export function startPlacement(rng: Rng): Placement {
  const ladder = strandLadder()
  const base: Placement = {
    ladder, strandIndex: 0, phase: 'easiest', lo: 0, hi: 0, best: -1, placed: [], asked: 0,
  }
  return { ...base, probe: probeAt(base, 0, rng) }
}

export const currentProbe = (p: Placement): Problem | undefined => p.probe

export const isPlacementComplete = (p: Placement): boolean => p.strandIndex >= p.ladder.length

/** Bank what this strand established and move to the next one. */
function finishStrand(p: Placement, best: number, rng: Rng): Placement {
  const placed = [...p.placed, ...skillsAt(p).slice(0, best + 1).map((s) => s.id)]
  const next: Placement = {
    ...p, placed, strandIndex: p.strandIndex + 1, phase: 'easiest', lo: 0, hi: 0, best: -1, probe: undefined,
  }
  return isPlacementComplete(next) ? next : { ...next, probe: probeAt(next, 0, rng) }
}

export function answerProbe(p: Placement, correct: boolean, rng: Rng): Placement {
  if (isPlacementComplete(p)) return p

  const skills = skillsAt(p)
  const last = skills.length - 1
  const asked = p.asked + 1
  const state = { ...p, asked }

  switch (p.phase) {
    // Can they do the easiest thing in this strand at all?
    case 'easiest': {
      if (!correct) return finishStrand(state, -1, rng)
      if (last === 0) return finishStrand(state, 0, rng)
      return { ...state, phase: 'hardest', best: 0, probe: probeAt(state, last, rng) }
    }

    // Can they do the hardest? Then the whole strand is already theirs.
    case 'hardest': {
      if (correct) return finishStrand(state, last, rng)
      const lo = 1
      const hi = last - 1
      if (lo > hi) return finishStrand(state, 0, rng)
      const mid = Math.floor((lo + hi) / 2)
      return { ...state, phase: 'search', lo, hi, probe: probeAt(state, mid, rng) }
    }

    // Narrow down where they stop.
    default: {
      const mid = Math.floor((p.lo + p.hi) / 2)
      const lo = correct ? mid + 1 : p.lo
      const hi = correct ? p.hi : mid - 1
      const best = correct ? mid : p.best
      if (lo > hi) return finishStrand({ ...state, best }, best, rng)
      return { ...state, lo, hi, best, probe: probeAt(state, Math.floor((lo + hi) / 2), rng) }
    }
  }
}

/** The starting point the quiz established. */
export function placementToProgress(p: Placement): Progress {
  return { ...emptyProgress(), placed: [...p.placed], placementDone: true }
}
