'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Keypad } from './Keypad'
import { Maths } from './Maths'
import { answer as submitAnswer, completesProblem, currentProblem, isComplete, startSession, summary, type Session } from '@/lib/session/session'
import { canSubmit as entryCanSubmit, choiceForKey, isEntryKey, press } from '@/lib/session/keypad'
import type { Verdict } from '@/lib/curriculum/types'
import { feedbackText, formatAnswer } from '@/lib/problems/format'
import { seeded } from '@/lib/problems'
import { SKILL_BY_ID } from '@/lib/curriculum/skills'
import { gapBehind } from '@/lib/session/diagnose'
import { topicIsA, type PickReason } from '@/lib/session/weakest'
import type { Progress } from '@/lib/mastery/mastery'
import type { ImplementedSkill } from '@/lib/problems'

/**
 * How long the learner sees the outcome before moving on. A wrong answer needs
 * longer — there is an answer to read — while "Yes!" is only celebration.
 * Either way, typing ahead skips it; see `advance`.
 */
const FEEDBACK_CORRECT_MS = 700
const FEEDBACK_WRONG_MS = 1500

type Feedback = { verdict: Verdict; expected: string }

type Props = {
  skill: ImplementedSkill
  /** Why this topic. The app chose it; being told why is the difference
   *  between being guided and being pushed around. */
  reason?: PickReason
  progress: Progress
  onProgress: (progress: Progress) => void
  /** Move on to whatever is weakest now — which may well be this again. */
  onNext?: () => void
  onLeave: () => void
  /** Jump straight to another skill — used by the gap suggestion. */
  onPickSkill?: (skill: ImplementedSkill) => void
  /**
   * Whose session this is, and how to hand the device over.
   *
   * On screen because the app now opens straight into a session: a sibling
   * picking the device up lands mid-someone-else's topic, and if they answer
   * first it goes into the wrong journey — the exact mixing profiles exist to
   * stop. Seeing the name is what prevents it.
   */
  profileName?: string
  onSwitchProfile?: () => void
  /**
   * Fix the session seed. Omitted in the app (the clock supplies it), set in
   * tests — and the hook a "replay this session" feature would use, since the
   * same seed reproduces the same twenty problems.
   */
  seed?: number
}

export function Practice({
  skill, reason, progress, onProgress, onNext, onLeave, onPickSkill,
  profileName, onSwitchProfile, seed,
}: Props) {
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
    // `pending` is empty when the last answer did not finish the problem — an
    // unsimplified fraction — in which case this just clears and lets them retry.
    const next = pending.current
    pending.current = null
    if (next) setSession(next)
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

    setFeedback({ verdict, expected: formatAnswer(problem.answer) })

    // An unsimplified answer is right but unfinished, so it neither scores nor
    // moves them on: the feedback clears and they answer the same question
    // again. Nothing is recorded, because they have not finished it yet.
    if (!completesProblem(verdict)) {
      timer.current = window.setTimeout(advance, FEEDBACK_WRONG_MS)
      return
    }

    onProgress(next.progress)
    pending.current = next
    timer.current = window.setTimeout(
      advance, verdict === 'correct' ? FEEDBACK_CORRECT_MS : FEEDBACK_WRONG_MS)
  }, [session, feedback, onProgress, advance])

  const onKey = useCallback((key: string) => {
    if (feedback || !problem) return
    if (key.startsWith('choice:')) return commit(key.slice('choice:'.length))
    setEntry((e) => press(e, key, problem.answer))
  }, [feedback, commit, problem])

  // Physical keyboard, for older children and anyone on a laptop.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Every rule below depends on what kind of answer is wanted.
      if (!problem) return

      // Typing while the outcome is on screen means they have moved on. Skip
      // the feedback and keep the keystroke — dropping it silently truncates
      // the next answer, which marks a correct answer wrong.
      if (feedback) {
        if (!isEntryKey(e.key, problem.answer)) return
        advance()
        setEntry((v) => press(v, e.key, problem.answer))
        return
      }

      // Leaving should never need a mouse.
      if (e.key === 'Escape') return onLeave()

      /**
       * A choice is tapped, not typed — but on a laptop there is nothing to
       * tap. A symbol option is pressed directly, a word option by its first
       * letter, so "<" and "y" answer without reaching for the trackpad.
       */
      const choice = choiceForKey(e.key, problem.answer)
      if (choice) return commit(choice)

      if (isEntryKey(e.key, problem.answer)) setEntry((v) => press(v, e.key, problem.answer))
      else if (e.key === 'Backspace') setEntry((v) => press(v, 'back', problem.answer))
      else if (e.key === 'Enter' && entryCanSubmit(entry, problem.answer)) commit(entry)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [feedback, problem, commit, advance, entry, onLeave])

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
            {stats.correct}<span className="text-slate-400 dark:text-slate-500">/{stats.answered}</span>
          </p>
          <h1 className="mt-3 text-xl font-semibold text-slate-600 dark:text-slate-300">{label}</h1>
          {/*
            Reaching the cap is a deferral, not a failure, and not mercy either:
            the topic is still their weakest and comes back. Saying "that's
            enough for today" is the truth; "well done" would not be.
          */}
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            {stats.goal.reachedCap
              ? "That's enough for today. We'll pick this one up again next time."
              : 'Nine out of ten. That was the goal.'}
          </p>
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
            {/*
              "Keep going", not "Again": what comes next is the app's call, and
              it may well be this same topic. Saying "Again" would promise a
              repeat and then sometimes hand them something else.
            */}
            <button
              type="button"
              onClick={onNext ?? begin}
              className="h-14 w-full rounded-2xl bg-emerald-600 text-lg font-semibold text-white
                         transition active:scale-95 hover:bg-emerald-700"
            >
              Keep going
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="h-14 w-full rounded-2xl text-lg font-semibold text-slate-500
                         transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              See how I&apos;m doing
            </button>
            {/* The end of a session is when the device actually changes hands. */}
            {onSwitchProfile && (
              <button
                type="button"
                onClick={onSwitchProfile}
                className="h-12 w-full rounded-2xl text-base font-semibold text-slate-400
                           transition hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
              >
                Switch to someone else
              </button>
            )}
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
            className="-ml-1 truncate rounded px-1 hover:text-slate-900 dark:hover:text-slate-100"
            aria-label="See how I'm doing"
          >
            ← {label}
          </button>
          {/*
            The finish line moves, so the counter says so. Freezing it at
            "/ 20" while the session quietly continued past twenty would read
            as a broken app — and the child would have no idea what to do about
            it. Getting them right is what brings this number down.
          */}
          <span className="shrink-0 tabular-nums">
            {/* A separator, or "Adding two-digit numbers Eddie" reads as one phrase. */}
            {profileName && <span className="text-slate-400 dark:text-slate-500">{profileName} · </span>}
            {stats.answered + 1} / {stats.total}
          </span>
        </div>

        {/*
          Sessions interleave, so a session on one topic shows others.
          Unexplained, that reads as the app being random rather than
          deliberate — so say which topic a problem came from when it is not
          the one they chose.
        */}
        <p className="mt-2 h-5 text-xs text-slate-400 dark:text-slate-500">
          {problem.skill !== skill
            ? `Review · ${SKILL_BY_ID.get(problem.skill)?.label ?? ''}`
            : reason && topicIsA(reason)}
        </p>
        {/*
          Only once they are past the minimum and the session is still going.
          Before that "12 / 20" explains itself; after it, a counter that keeps
          moving needs a reason attached, and the reason is the actual rule.
        */}
        {stats.answered >= session.minimum && (
          <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-500">
            {stats.goal.right} of your last {stats.goal.window} right · {stats.goal.required} needed
          </p>
        )}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(stats.answered / Math.max(stats.total, 1)) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <p
          // Announced on change, so a screen-reader user hears the next
          // question without hunting for it.
          aria-live="polite"
          className="text-center text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl"
        >
          <Maths text={problem.prompt} />
        </p>

        <div
          aria-live="polite"
          className={`grid h-20 place-items-center rounded-2xl text-4xl font-bold transition-colors ${
            !feedback
              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50'
              : feedback.verdict === 'correct'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                : feedback.verdict === 'equivalent-unsimplified'
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400'
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
          }`}
        >
          {feedback
            ? <Maths text={feedbackText(feedback.verdict, feedback.expected)} />
            : entry
              ? <Maths text={entry} />
              : <span className="text-slate-300 dark:text-slate-600">?</span>}
        </div>
      </div>

      <Keypad
        answer={problem.answer}
        onKey={onKey}
        onSubmit={() => commit(entry)}
        canSubmit={entryCanSubmit(entry, problem.answer)}
        disabled={feedback !== null}
      />
    </main>
  )
}
