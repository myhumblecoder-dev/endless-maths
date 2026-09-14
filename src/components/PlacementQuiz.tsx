'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Keypad } from './Keypad'
import {
  answerProbe, currentProbe, isPlacementComplete, placementToProgress, startPlacement, MAX_PROBES,
} from '@/lib/placement/placement'
import { canSubmit as entryCanSubmit, press } from '@/lib/session/keypad'
import { check } from '@/lib/problems/check'
import { seeded } from '@/lib/problems'
import type { Progress } from '@/lib/mastery/mastery'
import type { Placement } from '@/lib/placement/placement'
import type { Rng } from '@/lib/curriculum/types'

/**
 * A one-time quiz across every strand, so nobody has to grind number bonds to
 * reach times tables. Deliberately does NOT show right/wrong: it is a placement,
 * not a test, and a beginner will get most of it wrong by design.
 */
export function PlacementQuiz({ onDone }: { onDone: (progress: Progress) => void }) {
  const [placement, setPlacement] = useState<Placement | null>(null)
  const [entry, setEntry] = useState('')
  const rng = useRef<Rng | null>(null)

  // Seeded from the clock, so it cannot exist during server rendering.
  useEffect(() => {
    rng.current = seeded(Date.now())
    setPlacement(startPlacement(rng.current))
  }, [])

  const commit = useCallback((given: string) => {
    if (!placement || !rng.current) return
    const current = currentProbe(placement)
    if (!current) return

    const next = answerProbe(placement, check(current.answer, given) === 'correct', rng.current)
    setEntry('')

    if (isPlacementComplete(next)) onDone(placementToProgress(next))
    else setPlacement(next)
  }, [placement, onDone])

  const probe = placement ? currentProbe(placement) : undefined
  if (!placement || !probe) {
    return <main className="grid min-h-dvh place-items-center text-slate-400">Loading…</main>
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-5">
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Let&apos;s find out what you already know
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-300"
            style={{ width: `${Math.min((placement.asked / MAX_PROBES) * 100, 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Some of these will be too hard — skip them by guessing, that&apos;s fine.
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <p className="text-center text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
          {probe.prompt}
        </p>
        <div className="grid h-20 place-items-center rounded-2xl bg-slate-100 text-4xl font-bold text-slate-900 dark:bg-slate-800 dark:text-slate-50">
          {entry || <span className="text-slate-300 dark:text-slate-600">?</span>}
        </div>
      </div>

      <div className="space-y-3">
        <Keypad
          answer={probe.answer}
          onKey={(key) => {
            if (key.startsWith('choice:')) commit(key.slice('choice:'.length))
            else setEntry((e) => press(e, key))
          }}
          onSubmit={() => commit(entry)}
          canSubmit={entryCanSubmit(entry)}
          disabled={false}
        />
        {/* A beginner must be able to move on without guessing wildly. */}
        <button
          type="button"
          onClick={() => commit('')}
          className="h-12 w-full rounded-2xl text-lg font-semibold text-slate-400 transition
                     hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
        >
          I don&apos;t know this one
        </button>
      </div>
    </main>
  )
}
