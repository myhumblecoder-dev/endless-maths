'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Keypad } from './Keypad'
import { SESSION_LENGTH, answer as submitAnswer, currentProblem, isComplete, startSession, summary, type Session } from '@/lib/session/session'
import { canSubmit as entryCanSubmit, isEntryKey, press } from '@/lib/session/keypad'
import { feedbackText, formatAnswer } from '@/lib/problems/format'
import { seeded } from '@/lib/problems'
import { SKILL_BY_ID } from '@/lib/curriculum/skills'
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
}

export function Practice({ skill, progress, onProgress, onLeave }: Props) {
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
    setSession(startSession(latestProgress.current, seeded(Date.now()), { skill }))
    setEntry('')
    setFeedback(null)
    shownAt.current = Date.now()
  }, [skill])

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

  if (!session || !stats) {
    return <main className="grid min-h-dvh place-items-center text-slate-400">Loading…</main>
  }

  if (isComplete(session)) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
        <div>
          <p className="text-7xl">{stats.correct === stats.total ? '🏆' : '⭐'}</p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50">All done!</h1>
          <p className="mt-2 text-xl text-slate-600 dark:text-slate-300">
            You got <strong>{stats.correct}</strong> out of <strong>{stats.total}</strong>
          </p>
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={begin}
              className="h-16 w-full rounded-2xl bg-emerald-500 text-2xl font-bold text-white
                         transition active:scale-95 hover:bg-emerald-600"
            >
              Go again
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="h-14 w-full rounded-2xl text-lg font-semibold text-slate-500
                         transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Pick something else
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (!problem) return null

  const label = SKILL_BY_ID.get(problem.skill)?.label ?? ''

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
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
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
