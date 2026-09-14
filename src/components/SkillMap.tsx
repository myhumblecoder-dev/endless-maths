'use client'

import { useState } from 'react'
import { SKILLS } from '@/lib/curriculum/skills'
import { GENERATORS, type ImplementedSkill } from '@/lib/problems'
import { isSkillMastered, type Progress } from '@/lib/mastery/mastery'
import { unlockedSkills } from '@/lib/session/scheduler'
import type { Strand } from '@/lib/curriculum/types'

const STRAND_LABEL: Record<Strand, string> = {
  'number-sense': 'Numbers',
  'add-sub': 'Adding & taking away',
  'mul-div': 'Times & sharing',
  fractions: 'Decimals & percentages',
  'ratio-negatives': 'Bigger ideas',
  'pre-algebra': 'Algebra',
}

/**
 * The whole map, always visible. Locked skills are shown but not selectable —
 * seeing what is coming is motivating; being able to faceplant into it is not.
 * Placement is what gets a learner to the right part of the map, not tapping
 * through the locks.
 */
export function SkillMap({
  progress,
  onPick,
  onRetakePlacement,
}: {
  progress: Progress
  onPick: (skill: ImplementedSkill) => void
  onRetakePlacement: () => void
}) {
  const unlocked = new Set(unlockedSkills(progress))
  const strands = Object.keys(STRAND_LABEL) as Strand[]
  const [confirming, setConfirming] = useState(false)

  return (
    <main className="mx-auto min-h-dvh max-w-md p-5">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Topics</h1>

      <div className="mt-6 space-y-7">
        {strands.map((strand) => {
          const skills = SKILLS.filter((s) => s.strand === strand && s.id in GENERATORS)
          if (skills.length === 0) return null

          return (
            <section key={strand}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {STRAND_LABEL[strand]}
              </h2>
              <ul className="mt-2 space-y-2">
                {skills.map((skill) => {
                  const done = isSkillMastered(progress, skill.id)
                  const open = unlocked.has(skill.id as ImplementedSkill)

                  return (
                    <li key={skill.id}>
                      <button
                        type="button"
                        disabled={!open}
                        onClick={() => onPick(skill.id as ImplementedSkill)}
                        aria-label={`${skill.label}${open ? '' : ' (locked)'}`}
                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-lg transition
                          ${open
                            ? 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:scale-[0.99] dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700'
                            : 'cursor-not-allowed bg-transparent text-slate-300 dark:text-slate-600'}`}
                      >
                        <span aria-hidden className="w-5 text-center">
                          {done ? '✓' : open ? '●' : '○'}
                        </span>
                        <span className="flex-1">{skill.label}</span>
                        {done && <span className="text-sm text-emerald-600 dark:text-emerald-400">done</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      <p className="mt-8 text-center text-sm text-slate-400 dark:text-slate-500">
        ✓ done · ● ready · ○ not yet
      </p>

      {/*
        Placement is one snapshot, so a bad day can strand a learner at a level
        that is far too easy. Two taps, because wiping a level by accident is
        worse than the problem it solves.
      */}
      <div className="mb-10 mt-6 text-center">
        {confirming ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You&apos;ll retake the level check.
            </p>
            <button
              type="button"
              onClick={onRetakePlacement}
              className="h-12 w-full rounded-2xl bg-sky-500 text-lg font-semibold text-white
                         transition active:scale-95 hover:bg-sky-600"
            >
              Yes, retake it
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-12 w-full rounded-2xl text-lg font-semibold text-slate-500
                         transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-slate-400 underline-offset-4 transition hover:underline dark:text-slate-500"
          >
            Change my level
          </button>
        )}
      </div>
    </main>
  )
}
