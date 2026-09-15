import { test } from 'vitest'
import assert from 'node:assert/strict'
import { startPlacement, currentProbe, answerProbe, isPlacementComplete, placementToProgress } from './placement/placement'
import { startSession, currentProblem, answer, isComplete, summary } from './session/session'
import { unlockedSkills } from './session/scheduler'
import { canSubmit, press } from './session/keypad'
import type { Answer } from './curriculum/types'
import { emptyProgress, record } from './mastery/mastery'
import { loadProgress, saveProgress, type KeyValueStore } from './mastery/storage'
import { seeded, generate, IMPLEMENTED } from './problems'
import { formatAnswer } from './problems/format'

/**
 * Soak tests.
 *
 * These do not check that answers are graded correctly — the other suites do
 * that. They check that the system never THROWS, because an uncaught error is
 * a blank screen, and a blank screen in front of a child sitting on their own
 * is the worst thing this app can do.
 */

const store = (): KeyValueStore => {
  const data: Record<string, string> = {}
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v } }
}

/** Build an entry the way the keypad does, one press at a time. */
function typeIn(text: string, answer: Answer): string {
  let entry = ''
  for (const ch of text) entry = press(entry, ch === '−' ? '-' : ch, answer)
  return entry
}

test('every generator survives heavy repeated use', () => {
  // `until()` throws if a constraint cannot be met in 200 attempts, which would
  // blank the screen mid-session. Hammer every generator to prove it cannot.
  for (const skill of IMPLEMENTED) {
    const rng = seeded(1)
    for (let i = 0; i < 5000; i++) {
      const p = generate(skill, rng)
      assert.ok(p.prompt.length > 0, `${skill} produced an empty prompt`)
      assert.ok(formatAnswer(p.answer).length > 0, `${skill} produced an unrenderable answer`)
    }
  }
})

test('placement completes from any seed and any pattern of answers', () => {
  for (let seed = 0; seed < 300; seed++) {
    const rng = seeded(seed)
    let p = startPlacement(rng)
    let guard = 0
    while (!isPlacementComplete(p)) {
      assert.ok(currentProbe(p), `seed ${seed}: incomplete placement with no probe`)
      p = answerProbe(p, rng() < 0.5, rng)
      assert.ok(++guard < 200, `seed ${seed}: placement did not terminate`)
    }
    const progress = placementToProgress(p)
    assert.ok(unlockedSkills(progress).length > 0, `seed ${seed}: placed with nothing to practise`)
  }
})

test('a full session plays to the end from any placement', () => {
  for (let seed = 0; seed < 150; seed++) {
    const rng = seeded(seed)

    let placement = startPlacement(rng)
    while (!isPlacementComplete(placement)) placement = answerProbe(placement, rng() < 0.5, rng)
    const progress = placementToProgress(placement)

    const unlocked = unlockedSkills(progress)
    const skill = unlocked[Math.floor(rng() * unlocked.length)]
    let session = startSession(progress, rng, { skill })

    while (!isComplete(session)) {
      const problem = currentProblem(session)
      assert.ok(problem, `seed ${seed}: no problem before completion`)
      // Half right, half nonsense — a real child does both.
      const text = rng() < 0.5 ? formatAnswer(problem.answer) : String(Math.floor(rng() * 1000))
      const entry = typeIn(text, problem.answer)
      session = answer(session, canSubmit(entry, problem.answer) ? entry : '', Math.floor(rng() * 20000), seed * 1000)
    }

    const s = summary(session)
    assert.equal(s.answered, s.total, `seed ${seed}: session ended without answering everything`)
    assert.ok(s.correct <= s.total)
  }
})

test('progress survives hundreds of save and load round trips', () => {
  const kv = store()
  let progress = emptyProgress()
  const rng = seeded(99)

  for (let i = 0; i < 500; i++) {
    const skill = IMPLEMENTED[Math.floor(rng() * IMPLEMENTED.length)]
    const p = generate(skill, rng)
    progress = record(progress, {
      problemId: p.id, skill: p.skill, factKey: p.factKey,
      given: 'x', verdict: rng() < 0.5 ? 'correct' : 'incorrect',
      elapsedMs: Math.floor(rng() * 10000), at: i,
    })
    saveProgress(kv, progress)
    progress = loadProgress(kv)
  }

  assert.deepEqual(loadProgress(kv), progress, 'progress drifted across round trips')
  assert.ok(Object.keys(progress.skills).length > 0)
})

test('any storage state a real device could produce stays usable', () => {
  const nasty = [
    '', '   ', 'null', 'undefined', '0', 'false', '[]', '{}', '"a string"',
    '{"facts":null,"skills":null}',
    '{"facts":{},"skills":{},"placed":null}',
    '{"facts":{},"skills":{},"placed":"nope","placementDone":"yes"}',
    '{"facts":{},"skills":{},"placed":[],"placementDone":true,"extra":1}',
    '{"facts":{},', '[[[[[', '{"a":1}',
  ]
  for (const raw of nasty) {
    const kv: KeyValueStore = { getItem: () => raw, setItem: () => {} }
    const p = loadProgress(kv)
    assert.ok(Array.isArray(p.placed), `${raw.slice(0, 20)} produced a bad placed`)
    assert.equal(typeof p.placementDone, 'boolean', `${raw.slice(0, 20)} produced a bad placementDone`)
    assert.ok(unlockedSkills(p).length > 0, `${raw.slice(0, 20)} left nothing practisable`)
  }
})
