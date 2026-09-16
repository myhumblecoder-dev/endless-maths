'use client'

import { useState } from 'react'
import type { ProfileState } from '@/lib/mastery/profiles'

/**
 * Who is practising.
 *
 * `localStorage` is per-browser, not per-person, so before this two children
 * sharing a device overwrote each other's journeys. Names are shown so a child
 * recognises their own, and never leave the device.
 */
export function ProfilePicker({
  state,
  onChoose,
  onAdd,
  onRemove,
}: {
  state: ProfileState
  onChoose: (id: string) => void
  onAdd: (name: string) => void
  onRemove: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  const add = () => {
    const trimmed = name.trim()
    if (trimmed === '') return
    onAdd(trimmed)
    setName('')
  }

  const pending = state.profiles.find((p) => p.id === confirming)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Who&apos;s practising?</h1>

      {pending ? (
        // Deleting destroys a journey, so it takes two deliberate actions and
        // says what will be lost.
        <div className="space-y-3">
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Delete <strong>{pending.name}</strong>? All of their progress and practice history
            goes with them, and it cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => { onRemove(pending.id); setConfirming(null) }}
            className="h-14 w-full rounded-2xl bg-rose-600 text-lg font-semibold text-white
                       transition active:scale-95 hover:bg-rose-700"
          >
            Yes, delete {pending.name}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className="h-12 w-full rounded-2xl text-base font-semibold text-slate-500
                       transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {state.profiles.map((profile) => (
              <li key={profile.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChoose(profile.id)}
                  className="h-16 flex-1 rounded-2xl bg-slate-100 text-left text-xl font-semibold
                             text-slate-900 transition active:scale-[0.99] hover:bg-slate-200
                             dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700"
                >
                  <span className="px-5">{profile.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(profile.id)}
                  aria-label={`Remove ${profile.name}`}
                  className="h-16 w-12 rounded-2xl text-slate-400 transition hover:bg-slate-100
                             dark:hover:bg-slate-800"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="space-y-3">
            <label htmlFor="new-profile" className="block text-sm text-slate-500 dark:text-slate-400">
              Add someone
            </label>
            <input
              id="new-profile"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add() }}
              placeholder="Their name"
              className="h-14 w-full rounded-2xl bg-slate-100 px-5 text-lg text-slate-900
                         placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-50"
            />
            <button
              type="button"
              onClick={add}
              className="h-14 w-full rounded-2xl bg-emerald-600 text-lg font-semibold text-white
                         transition active:scale-95 hover:bg-emerald-700"
            >
              Add
            </button>
          </div>
        </>
      )}
    </main>
  )
}
