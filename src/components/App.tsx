'use client'

import { useCallback, useEffect, useState } from 'react'
import { PlacementQuiz } from './PlacementQuiz'
import { PlacementResult } from './PlacementResult'
import { SkillMap } from './SkillMap'
import { Practice } from './Practice'
import { browserStore, loadProgress, saveProgress } from '@/lib/mastery/storage'
import type { Progress } from '@/lib/mastery/mastery'
import type { ImplementedSkill } from '@/lib/problems'

/**
 * Three screens: sit the placement quiz once, then choose from the map, then
 * practise. Progress is read from and written to localStorage only — it never
 * reaches a server.
 */
export function App() {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [skill, setSkill] = useState<ImplementedSkill | null>(null)
  /**
   * Show the level check's result before the map. Two real learners sat the
   * quiz and could not tell where it had put them, because it ended by dropping
   * them straight onto the topic list.
   */
  const [showingResult, setShowingResult] = useState(false)
  /** Stamped when the map is shown, not read during render. */
  const [now, setNow] = useState(0)

  /* eslint-disable react-hooks/set-state-in-effect --
     Deferred init. Neither localStorage nor the clock exists during server
     rendering, so both have to be read on mount. */
  useEffect(() => {
    setProgress(loadProgress(browserStore()))
    setNow(Date.now())
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = useCallback((next: Progress) => {
    saveProgress(browserStore(), next)
    setProgress(next)
  }, [])

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
        onLeave={() => setSkill(null)}
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
      now={now}
    />
  )
}
