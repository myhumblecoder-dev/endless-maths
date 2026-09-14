'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Keypad } from './Keypad'
import { SESSION_LENGTH, answer as submitAnswer, currentProblem, isComplete, startSession, summary, type Session } from '@/lib/session/session'
import { canSubmit as entryCanSubmit, press } from '@/lib/session/keypad'
import { formatAnswer } from '@/lib/problems/format'
import { seeded } from '@/lib/problems'
import { SKILL_BY_ID } from '@/lib/curriculum/skills'
import { browserStore, loadProgress, saveProgress } from '@/lib/mastery/storage'

/** How long the child sees whether they were right before moving on. */
const FEEDBACK_MS = 1100

type Feedback = { correct: boolean; expected: string }

export function Practice() {
  // Progress lives in localStorage, so the first render must be server-safe.
  const [session, setSession] = useState<Session | null>(null)
  const [entry, setEntry] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const shownAt = useRef<number>(0)

  const begin = useCallback(() => {
    const progress = loadProgress(browserStore())
    setSession(startSession(progress, seeded(Date.now())))
    setEntry('')
    setFeedback(null)
    shownAt.current = Date.now()
  }, [])

  // Deliberate deferred init. The session seed is `Date.now()` and progress
  // comes from localStorage, so neither exists during server rendering —
  // building the session on mount is what keeps hydration consistent.
  // eslint-disable-next-line react-hooks/set-state-in-effect
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

    setFeedback({ correct: verdict === 'correct', expected: formatAnswer(problem.answer) })
    saveProgress(browserStore(), next.progress)

    window.setTimeout(() => {
      setSession(next)
      setEntry('')
      setFeedback(null)
    }, FEEDBACK_MS)
  }, [session, feedback])

  const onKey = useCallback((key: string) => {
    if (feedback) return
    if (key.startsWith('choice:')) return commit(key.slice('choice:'.length))
    setEntry((e) => press(e, key))
  }, [feedback, commit])

  // Physical keyboard, for older children and anyone on a laptop.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (feedback || !problem) return
      if (/^[0-9]$/.test(e.key)) setEntry((v) => press(v, e.key))
      else if (e.key === 'Backspace') setEntry((v) => press(v, 'back'))
      else if (e.key === '.' || e.key === '-') setEntry((v) => press(v, e.key))
      else if (e.key === 'Enter') setEntry((v) => { if (entryCanSubmit(v)) commit(v); return v })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [feedback, problem, commit])

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
          <button
            type="button"
            onClick={begin}
            className="mt-8 h-16 w-full rounded-2xl bg-emerald-500 text-2xl font-bold text-white
                       transition active:scale-95 hover:bg-emerald-600"
          >
            Go again
          </button>
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
        <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{label}</span>
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
            ? feedback.correct
              ? '✓ Yes!'
              : `${feedback.expected}`
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
