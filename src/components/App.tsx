'use client'

import { useCallback, useEffect, useState } from 'react'
import { PlacementQuiz } from './PlacementQuiz'
import { PlacementResult } from './PlacementResult'
import { ProfilePicker } from './ProfilePicker'
import { SkillMap } from './SkillMap'
import { Practice } from './Practice'
import { loadProgress, saveProgress, type KeyValueStore } from '@/lib/mastery/storage'
import {
  addProfile, adoptLegacyRecord, loadProfiles, progressKeyFor, removeProfile, saveProfiles,
  type ProfileState, type ProfileStore,
} from '@/lib/mastery/profiles'
import { pickTopic, type Pick } from '@/lib/session/weakest'
import type { Progress } from '@/lib/mastery/mastery'
import type { ImplementedSkill } from '@/lib/problems'

/**
 * Four screens: pick who is practising, sit the level check once, see what it
 * decided, then practise — on the topic the app chose.
 *
 * The child does not pick the topic. Given a list, a learner picks what they
 * are already good at, which is the one thing practice cannot improve. The
 * topic map is still there, as somewhere to see how it is going.
 *
 * Progress is read from and written to localStorage only, under a key per
 * profile — the store is per-browser rather than per-person, so a single key
 * meant two children overwrote each other.
 */

const NO_STORE: ProfileStore = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, keys: () => [],
}

/**
 * `localStorage` when it is available.
 *
 * Absent during server rendering, and **reading the property itself throws** in
 * Safari with cookies blocked or inside a sandboxed iframe. That throw happened
 * outside every try/catch downstream, so a blocked store meant the crash screen
 * on every single load.
 */
function browserProfileStore(): ProfileStore {
  if (typeof window === 'undefined') return NO_STORE
  try {
    const store = window.localStorage
    return {
      getItem: (k) => store.getItem(k),
      setItem: (k, v) => store.setItem(k, v),
      removeItem: (k) => store.removeItem(k),
      keys: () => Object.keys(store),
    }
  } catch {
    // Practice still works; nothing is remembered between sessions.
    return NO_STORE
  }
}

/** The one profile's progress, addressed by its own key. */
const progressStoreFor = (profileId: string): KeyValueStore => {
  const key = progressKeyFor(profileId)
  const store = browserProfileStore()
  return {
    // storage.ts addresses a fixed key; this points it at this profile's.
    getItem: () => store.getItem(key),
    setItem: (_ignored, value) => store.setItem(key, value),
  }
}

export function App() {
  const [profiles, setProfiles] = useState<ProfileState | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  /**
   * The topic in hand, FROZEN for the length of the session.
   *
   * Deliberately state rather than `pickTopic(progress)` at render time.
   * Answering a question changes progress, which would change the pick, which
   * would restart the session from question one — the same shape of bug that
   * once pinned the counter at 1 / 20.
   */
  const [topic, setTopic] = useState<Pick | null>(null)
  const [showingProgress, setShowingProgress] = useState(false)
  const [showingResult, setShowingResult] = useState(false)
  /** Stamped when the map is shown, not read during render. */
  const [now, setNow] = useState(0)

  /* eslint-disable react-hooks/set-state-in-effect --
     Deferred init. Neither localStorage nor the clock exists during server
     rendering, so both have to be read on mount. */
  useEffect(() => {
    setProfiles(loadProfiles(browserProfileStore()))
    setNow(Date.now())
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeId = profiles?.activeId ?? null

  /* eslint-disable react-hooks/set-state-in-effect --
     Whose journey to load is only known once a profile is chosen. */
  useEffect(() => {
    const loaded = activeId ? loadProgress(progressStoreFor(activeId)) : null
    setProgress(loaded)
    /**
     * Pick the topic HERE, with the journey, not at render time.
     *
     * Leaving it null and falling back to `pickTopic(progress)` in the render
     * meant it was recomputed on every answer — and answering changes what is
     * weakest, so the topic could change out from under a session in progress.
     * On a fresh launch, which is every launch, it swapped topic after one
     * question and restarted the count.
     */
    setTopic(loaded?.placementDone ? pickTopic(loaded) : null)
    setShowingProgress(false)
    setShowingResult(false)
  }, [activeId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = useCallback((next: Progress) => {
    if (!activeId) return
    saveProgress(progressStoreFor(activeId), next)
    setProgress(next)
  }, [activeId])

  const persistProfiles = useCallback((next: ProfileState) => {
    saveProfiles(browserProfileStore(), next)
    setProfiles(next)
  }, [])

  /** Start the next session on whatever is weakest NOW, not when they sat down. */
  const nextTopic = useCallback((from: Progress) => {
    setTopic(pickTopic(from))
    setShowingProgress(false)
    setNow(Date.now())
  }, [])

  if (!profiles) {
    return <main className="grid min-h-dvh place-items-center text-slate-400">Loading…</main>
  }

  if (!activeId) {
    return (
      <ProfilePicker
        state={profiles}
        onChoose={(id) => {
          // Re-stamp the clock: handing the device over in the evening and
          // choosing the next morning would otherwise work out what is due
          // against yesterday.
          setNow(Date.now())
          persistProfiles({ ...profiles, activeId: id })
        }}
        onAdd={(name) =>
          persistProfiles(
            // Only the FIRST profile adopts the record left from before
            // profiles existed — everyone after starts their own journey.
            profiles.profiles.length === 0
              ? adoptLegacyRecord(browserProfileStore(), profiles, name, newProfileId())
              : addProfile(profiles, name, newProfileId()),
          )
        }
        onRemove={(id) => persistProfiles(removeProfile(browserProfileStore(), profiles, id))}
      />
    )
  }

  if (!progress) {
    return <main className="grid min-h-dvh place-items-center text-slate-400">Loading…</main>
  }

  if (!progress.placementDone) {
    return (
      <PlacementQuiz
        onDone={(placed) => {
          // Saved immediately: closing the tab on the result screen must not
          // mean sitting the whole quiz again.
          persist(placed)
          setShowingResult(true)
        }}
      />
    )
  }

  if (showingResult) {
    return (
      <PlacementResult
        progress={progress}
        onContinue={() => { setShowingResult(false); nextTopic(progress) }}
        onRetake={() => {
          setShowingResult(false)
          persist({ ...progress, placed: [], placementDone: false })
        }}
      />
    )
  }

  if (showingProgress) {
    return (
      <SkillMap
        progress={progress}
        upNext={topic ?? pickTopic(progress)}
        onBack={() => nextTopic(progress)}
        onRetakePlacement={() => persist({ ...progress, placed: [], placementDone: false })}
        onSessionLength={(sessionLength) => persist({ ...progress, sessionLength })}
        onSwitchProfile={() => persistProfiles({ ...profiles, activeId: null })}
        profileName={profiles.profiles.find((p) => p.id === activeId)?.name}
        now={now}
      />
    )
  }

  // Set alongside the journey it was chosen from, so this is only ever the one
  // frame between mount and that effect running.
  if (!topic) {
    return <main className="grid min-h-dvh place-items-center text-slate-400">Loading…</main>
  }

  return (
    <Practice
      skill={topic.skill}
      reason={topic.reason}
      progress={progress}
      onProgress={persist}
      onNext={() => nextTopic(progress)}
      onLeave={() => { setNow(Date.now()); setShowingProgress(true) }}
      onPickSkill={(skill: ImplementedSkill) => setTopic({ skill, reason: 'foundation' })}
      profileName={profiles.profiles.find((p) => p.id === activeId)?.name}
      onSwitchProfile={() => persistProfiles({ ...profiles, activeId: null })}
    />
  )
}

/** Opaque and local. Never sent anywhere; see docs/design.md. */
function newProfileId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `p_${random}`
}
