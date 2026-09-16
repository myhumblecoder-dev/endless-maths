'use client'

import { placementSummary } from '@/lib/placement/summary'
import type { Progress } from '@/lib/mastery/mastery'

/**
 * What the level check decided, shown before the topic map rather than left to
 * be inferred from it.
 *
 * Two real learners sat the quiz and neither they nor their parent could tell
 * where it had put them, because it ended by dropping them straight onto the
 * map. The retake lives here too: this is the moment someone can judge whether
 * the result is wrong, while the questions are still fresh.
 */
export function PlacementResult({
  progress,
  onContinue,
  onRetake,
}: {
  progress: Progress
  onContinue: () => void
  onRetake: () => void
}) {
  const { headline, startingWith } = placementSummary(progress)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Level check
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">{headline}</h1>
      </div>

      {startingWith.length > 0 ? (
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">You&apos;ll start with</p>
          <ul className="mt-2 space-y-2">
            {startingWith.map((topic) => (
              <li
                key={topic.id}
                className="rounded-xl bg-slate-100 px-4 py-3 text-lg text-slate-900 dark:bg-slate-800 dark:text-slate-50"
              >
                {topic.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
            More opens up as you go.
          </p>
        </div>
      ) : (
        // Placing out of everything leaves nothing to list, and an empty box
        // would read as a bug rather than a result.
        <p className="text-lg text-slate-600 dark:text-slate-300">
          That covered everything here. Pick any topic and practise whatever you like.
        </p>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={onContinue}
          className="h-14 w-full rounded-2xl bg-emerald-600 text-lg font-semibold text-white
                     transition active:scale-95 hover:bg-emerald-700"
        >
          Start practising
        </button>
        <button
          type="button"
          onClick={onRetake}
          className="h-12 w-full rounded-2xl text-base font-semibold text-slate-500
                     transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          That&apos;s not right — take the questions again
        </button>
      </div>
    </main>
  )
}
