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
import type { Progress } from '@/lib/mastery/mastery'
import type { ImplementedSkill } from '@/lib/problems'

/**
 * Four screens: pick who is practising, sit the level check once, see what it
 * decided, then choose a topic and practise.
 *
 * Progress is read from and written to localStorage only, under a key per
 * profile — the store is per-browser rather than per-person, so a single key
 * meant two children overwrote each other.
 */

/** `localStorage` when there is a window, otherwise a no-op for SSR. */
function browserProfileStore(): ProfileStore {
  if (typeof window === 'undefined') {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }
  return window.localStorage
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
  const [skill, setSkill] = useState<ImplementedSkill | null>(null)
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
    setProgress(activeId ? loadProgress(progressStoreFor(activeId)) : null)
    setSkill(null)
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

  if (!profiles) {
    return <main className="grid min-h-dvh place-items-center text-slate-400">Loading…</main>
  }

  if (!activeId) {
    return (
      <ProfilePicker
        state={profiles}
        onChoose={(id) => persistProfiles({ ...profiles, activeId: id })}
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
        onContinue={() => { setNow(Date.now()); setShowingResult(false) }}
        onRetake={() => {
          setShowingResult(false)
          persist({ ...progress, placed: [], placementDone: false })
        }}
      />
    )
  }

  if (skill) {
    return (
      <Practice
        skill={skill}
        progress={progress}
        onProgress={persist}
        onLeave={() => { setNow(Date.now()); setSkill(null) }}
        onPickSkill={setSkill}
      />
    )
  }

  return (
    <SkillMap
      progress={progress}
      onPick={setSkill}
      onRetakePlacement={() => persist({ ...progress, placed: [], placementDone: false })}
      onSessionLength={(sessionLength) => persist({ ...progress, sessionLength })}
      onSwitchProfile={() => persistProfiles({ ...profiles, activeId: null })}
      profileName={profiles.profiles.find((p) => p.id === activeId)?.name}
      now={now}
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
