'use client'

import { useState } from 'react'
import { SKILLS, SKILL_BY_ID } from '@/lib/curriculum/skills'
import { GENERATORS, type ImplementedSkill } from '@/lib/problems'
import { isSkillMastered, skillProgress, type Progress } from '@/lib/mastery/mastery'
import { blockedBy, unlockedSkills, weakestDueFirst } from '@/lib/session/scheduler'
import { SESSION_LENGTHS, sessionLengthOf } from '@/lib/session/length'
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
  onSessionLength,
  onSwitchProfile,
  profileName,
  now,
}: {
  progress: Progress
  onPick: (skill: ImplementedSkill) => void
  onRetakePlacement: () => void
  /** Change how many questions a session runs for. */
  onSessionLength?: (length: number) => void
  /** Hand the device to the other child. */
  onSwitchProfile?: () => void
  /** Whose journey this is. Local only — never leaves the device. */
  profileName?: string
  /**
   * The clock, for working out what is due. Passed in rather than read here —
   * calling Date.now() during render is impure and makes the component
   * re-render to different output for the same props.
   */
  now: number
}) {
  const unlocked = new Set(unlockedSkills(progress))
  const strands = Object.keys(STRAND_LABEL) as Strand[]
  const [confirming, setConfirming] = useState(false)

  /**
   * How many facts are waiting per skill. Shown so a learner can see where the
   * review in their next session will come from, rather than being surprised
   * by it mid-practice.
   */
  const dueCount = new Map<string, number>()
  for (const factKey of weakestDueFirst(progress, now)) {
    const s = progress.facts[factKey].skill
    dueCount.set(s, (dueCount.get(s) ?? 0) + 1)
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md p-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Topics</h1>
        {onSwitchProfile && (
          <button
            type="button"
            onClick={onSwitchProfile}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition
                       hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {profileName ? `${profileName} · Switch` : 'Switch'}
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Every session is mostly the topic you pick, mixed with review of things you have done before.
      </p>

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

                  /**
                   * A lock with no reason reads as the app being arbitrary, and
                   * to an older learner as being underestimated. Name the next
                   * step — the whole chain is true but not actionable.
                   */
                  const blockers = open
                    ? []
                    : blockedBy(progress, skill.id)
                        .map((id) => SKILL_BY_ID.get(id)?.label)
                        .filter((label): label is string => Boolean(label))
                  const reason = blockers.length > 0 ? `After ${blockers.join(' and ')}` : ''

                  /**
                   * A binary tick is thin for this age group. Accuracy over the
                   * trailing window, and whether it is moving, is what they can
                   * act on — stated flatly, because the retrieval research is
                   * clear that practice should not feel like constant judgement.
                   */
                  const stats = skillProgress(progress, skill.id)
                  const TREND_WORD = { up: 'improving', down: 'slipping', steady: 'steady', unknown: '' }
                  const figures = stats
                    ? [`${Math.round(stats.accuracy * 100)}%`, TREND_WORD[stats.trend]]
                        .filter(Boolean).join(' · ')
                    : ''

                  return (
                    <li key={skill.id}>
                      <button
                        type="button"
                        disabled={!open}
                        onClick={() => onPick(skill.id as ImplementedSkill)}
                        aria-label={
                          `${skill.label}${figures ? `. ${figures}` : ''}${open ? '' : ` (locked. ${reason})`}`
                        }
                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-lg transition
                          ${open
                            ? 'bg-slate-100 text-slate-900 hover:bg-slate-200 active:scale-[0.99] dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700'
                            : 'cursor-not-allowed bg-transparent text-slate-300 dark:text-slate-600'}`}
                      >
                        <span aria-hidden className="w-5 text-center">
                          {done ? '✓' : open ? '●' : '○'}
                        </span>
                        <span className="flex-1">
                          {skill.label}
                          {reason && (
                            <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-600">
                              {reason}
                            </span>
                          )}
                          {figures && (
                            <span className="mt-0.5 block text-xs tabular-nums text-slate-400 dark:text-slate-500">
                              {figures}
                            </span>
                          )}
                        </span>
                        {open && (dueCount.get(skill.id) ?? 0) > 0 && (
                          <span className="text-sm text-sky-600 dark:text-sky-400">
                            {dueCount.get(skill.id)} to review
                          </span>
                        )}
                        {done && (dueCount.get(skill.id) ?? 0) === 0 && !figures && (
                          <span className="text-sm text-emerald-600 dark:text-emerald-400">done</span>
                        )}
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
        Twenty was a guess. A short run before school and a longer one at the
        weekend are different things, so it is a choice — see length.ts.
      */}
      {onSessionLength && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Session length
          </p>
          <div className="mt-2 flex gap-2" role="group" aria-label="Session length">
            {SESSION_LENGTHS.map((length) => {
              const current = sessionLengthOf(progress) === length
              return (
                <button
                  key={length}
                  type="button"
                  aria-pressed={current}
                  onClick={() => onSessionLength(length)}
                  className={`h-11 flex-1 rounded-xl text-sm font-semibold transition ${
                    current
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {length} questions
                </button>
              )
            })}
          </div>
        </div>
      )}

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
