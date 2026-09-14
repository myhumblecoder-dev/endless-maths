'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Keypad } from './Keypad'
import { SESSION_LENGTH, answer as submitAnswer, currentProblem, isComplete, startSession, summary, type Session } from '@/lib/session/session'
import { canSubmit as entryCanSubmit, isEntryKey, press } from '@/lib/session/keypad'
import { feedbackText, formatAnswer } from '@/lib/problems/format'
import { seeded } from '@/lib/problems'
import { SKILL_BY_ID } from '@/lib/curriculum/skills'
import { gapBehind } from '@/lib/session/diagnose'
import type { Progress } from '@/lib/mastery/mastery'
import type { ImplementedSkill } from '@/lib/problems'

/**
 * How long the learner sees the outcome before moving on. A wrong answer needs
 * longer — there is an answer to read — while "Yes!" is only celebration.
 * Either way, typing ahead skips it; see `advance`.
 */
const FEEDBACK_CORRECT_MS = 700
const FEEDBACK_WRONG_MS = 1500

type Feedback = { correct: boolean; expected: string }

type Props = {
  skill: ImplementedSkill
  progress: Progress
  onProgress: (progress: Progress) => void
  onLeave: () => void
  /** Jump straight to another skill — used by the gap suggestion. */
  onPickSkill?: (skill: ImplementedSkill) => void
  /**
   * Fix the session seed. Omitted in the app (the clock supplies it), set in
   * tests — and the hook a "replay this session" feature would use, since the
   * same seed reproduces the same twenty problems.
   */
  seed?: number
}

export function Practice({ skill, progress, onProgress, onLeave, onPickSkill, seed }: Props) {
  // Session seeding uses the clock, so the first render must be server-safe.
  const [session, setSession] = useState<Session | null>(null)
  const [entry, setEntry] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const shownAt = useRef<number>(0)
  /** The session as it will be once the current feedback finishes. */
  const pending = useRef<Session | null>(null)
  const timer = useRef<number | null>(null)

  /**
   * Move to the next problem now, cancelling any pending timer. Called both by
   * the feedback timeout and by typing ahead.
   */
  const advance = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    const next = pending.current
    if (!next) return
    pending.current = null
    setSession(next)
    setEntry('')
    setFeedback(null)
  }, [])

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  // Read through a ref, NOT the prop directly. Answering a question calls
  // onProgress, which changes the `progress` prop, which would otherwise
  // invalidate `begin` and re-run the effect below — restarting the session
  // from problem 1 after every single answer.
  const latestProgress = useRef(progress)
  useEffect(() => { latestProgress.current = progress })

  const begin = useCallback(() => {
    setSession(startSession(latestProgress.current, seeded(seed ?? Date.now()), { skill, now: Date.now() }))
    setEntry('')
    setFeedback(null)
    shownAt.current = Date.now()
  }, [skill, seed])

  // Deferred init: the session seed is `Date.now()`, so it cannot exist during
  // server rendering. Runs on mount and whenever a different skill is chosen.
  useEffect(() => { begin() }, [begin])

  const problem = session ? currentProblem(session) : undefined

  // A new problem restarts the clock. Timing is collected silently — a visible
  // countdown produces maths anxiety in exactly this age group.
  useEffect(() => { shownAt.current = Date.now() }, [problem?.id, session?.index])

  const commit = useCallback((given: string) => {
    if (!session || feedback) return
    const problem = currentProblem(session)
    if (!problem) return

    const next = submitAnswer(session, given, Date.now() - shownAt.current, Date.now())
    const verdict = next.attempts[next.attempts.length - 1].verdict

    const correct = verdict === 'correct'
    setFeedback({ correct, expected: formatAnswer(problem.answer) })
    onProgress(next.progress)

    pending.current = next
    timer.current = window.setTimeout(advance, correct ? FEEDBACK_CORRECT_MS : FEEDBACK_WRONG_MS)
  }, [session, feedback, onProgress, advance])

  const onKey = useCallback((key: string) => {
    if (feedback) return
    if (key.startsWith('choice:')) return commit(key.slice('choice:'.length))
    setEntry((e) => press(e, key))
  }, [feedback, commit])

  // Physical keyboard, for older children and anyone on a laptop.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Typing while the outcome is on screen means they have moved on. Skip
      // the feedback and keep the keystroke — dropping it silently truncates
      // the next answer, which marks a correct answer wrong.
      if (feedback) {
        if (!isEntryKey(e.key)) return
        advance()
        setEntry((v) => press(v, e.key))
        return
      }
      if (!problem) return

      if (isEntryKey(e.key)) setEntry((v) => press(v, e.key))
      else if (e.key === 'Backspace') setEntry((v) => press(v, 'back'))
      else if (e.key === 'Enter' && entryCanSubmit(entry)) commit(entry)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [feedback, problem, commit, advance, entry])

  const stats = useMemo(() => (session ? summary(session) : null), [session])

  /** Median, not mean — one interruption should not skew the whole session. */
  const median = useMemo(() => {
    if (!session || session.attempts.length === 0) return null
    const times = session.attempts.map((a) => a.elapsedMs).sort((a, b) => a - b)
    return times[Math.floor(times.length / 2)]
  }, [session])

  if (!session || !stats) {
    return <main className="grid min-h-dvh place-items-center text-slate-400">Loading…</main>
  }

  const label = SKILL_BY_ID.get(skill)?.label ?? ''

  /**
   * Repeatedly failing a skill usually means something underneath it is
   * missing. Offered at the end rather than mid-session — interrupting someone
   * who is already struggling is the wrong moment — and only offered, never
   * forced.
   */
  const gap = isComplete(session) ? gapBehind(session.progress, skill) : undefined
  const gapLabel = gap ? SKILL_BY_ID.get(gap)?.label : undefined

  if (isComplete(session)) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
        <div className="w-full">
          <p className="text-6xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {stats.correct}<span className="text-slate-400 dark:text-slate-500">/{stats.total}</span>
          </p>
          <h1 className="mt-3 text-xl font-semibold text-slate-600 dark:text-slate-300">{label}</h1>
          {median !== null && (
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
              {(median / 1000).toFixed(1)}s per question
            </p>
          )}
          {gap && gapLabel && onPickSkill && (
            <div className="mt-8 rounded-2xl bg-sky-50 p-4 text-left dark:bg-sky-950/40">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                This one leans on <strong>{gapLabel}</strong>. Practising that first usually makes
                it click.
              </p>
              <button
                type="button"
                onClick={() => onPickSkill(gap)}
                className="mt-3 h-12 w-full rounded-xl bg-sky-600 text-base font-semibold text-white
                           transition active:scale-95 hover:bg-sky-700"
              >
                Practise {gapLabel}
              </button>
            </div>
          )}

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={begin}
              className="h-14 w-full rounded-2xl bg-emerald-600 text-lg font-semibold text-white
                         transition active:scale-95 hover:bg-emerald-700"
            >
              Again
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="h-14 w-full rounded-2xl text-lg font-semibold text-slate-500
                         transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Choose another topic
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (!problem) return null

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-5">
      {/* A visible finish line: the supply is endless, this session is not. */}
      <div>
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={onLeave}
            className="-ml-1 rounded px-1 hover:text-slate-900 dark:hover:text-slate-100"
            aria-label="Back to the skill list"
          >
            ← {label}
          </button>
          <span>{session.index + 1} / {SESSION_LENGTH}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(session.index / SESSION_LENGTH) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <p className="text-center text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
          {problem.prompt}
        </p>

        <div
          aria-live="polite"
          className={`grid h-20 place-items-center rounded-2xl text-4xl font-bold transition-colors ${
            feedback
              ? feedback.correct
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
              : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50'
          }`}
        >
          {feedback
            ? feedbackText(feedback.correct, feedback.expected)
            : entry || <span className="text-slate-300 dark:text-slate-600">?</span>}
        </div>
      </div>

      <Keypad
        answer={problem.answer}
        onKey={onKey}
        onSubmit={() => commit(entry)}
        canSubmit={entryCanSubmit(entry)}
        disabled={feedback !== null}
      />
    </main>
  )
}
