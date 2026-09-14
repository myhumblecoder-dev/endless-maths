import { test } from 'vitest'
import assert from 'node:assert/strict'
import { unlockedSkills, nextSkill, dueFacts } from './scheduler'
import { emptyProgress, record, type Progress } from '@/lib/mastery/mastery'
import { GENERATORS, seeded } from '@/lib/problems'
import type { SkillId } from '@/lib/curriculum/types'

/** Drive a skill to mastery: ten correct, fast answers. */
function master(p: Progress, skill: SkillId, factKey?: string): Progress {
  for (let i = 0; i < 10; i++) {
    p = record(p, {
      problemId: `${skill}#${i}`, skill, factKey,
      given: 'x', verdict: 'correct', elapsedMs: 1000, at: 1_000_000 + i,
    })
  }
  return p
}

test('a brand new learner has something to practise', () => {
  const unlocked = unlockedSkills(emptyProgress())
  assert.ok(unlocked.length > 0, 'a new learner must be offered something')
  assert.ok(unlocked.includes('n-bonds-10'), 'number bonds are the natural start')
})

/**
 * Every add/sub skill descends from `n-count-20`, which is Tier 3 and has no
 * generator. An unbuilt prerequisite has to be stepped OVER — inheriting what
 * it required — never simply dropped.
 */
test('an unbuilt prerequisite is stepped over, not dropped', () => {
  const unlocked = unlockedSkills(emptyProgress())
  // n-count-20 is unbuilt and is a genuine root, so bonds really are available.
  assert.ok(unlocked.includes('n-bonds-10'))
  // r-factors-multiples is unbuilt but is NOT a root — it sits behind division.
  // Dropping it would offer prime numbers to a five-year-old.
  assert.ok(
    !unlocked.includes('r-primes'),
    'primes must stay gated behind division, even though factors are unbuilt',
  )
  assert.ok(
    !unlocked.includes('r-proportion'),
    'proportion must stay gated behind its unbuilt ratio prerequisite',
  )
})

test('skills gated behind unmastered work are locked', () => {
  const unlocked = unlockedSkills(emptyProgress())
  assert.ok(!unlocked.includes('p-solve-two-step'), 'no two-step equations on day one')
  assert.ok(!unlocked.includes('m-times-6-7-8-9'), 'the hard tables come after the easy ones')
  assert.ok(!unlocked.includes('a-add-within-10'), 'adding to 10 follows number bonds')
})

test('mastering a skill unlocks what depends on it', () => {
  let p = emptyProgress()
  assert.ok(!unlockedSkills(p).includes('a-add-within-10'))
  p = master(p, 'n-bonds-10', 'bond10:4')
  assert.ok(unlockedSkills(p).includes('a-add-within-10'), 'bonds lead to adding within 10')
})

test('every unlocked skill can actually be generated', () => {
  let p = emptyProgress()
  for (const s of ['n-bonds-10', 'a-add-within-10', 'a-add-within-20'] as const) p = master(p, s)
  for (const s of unlockedSkills(p)) {
    assert.ok(s in GENERATORS, `${s} is offered but has no generator`)
  }
})

test('nextSkill always returns something unlocked', () => {
  const rng = seeded(99)
  const p = emptyProgress()
  for (let i = 0; i < 50; i++) {
    assert.ok(unlockedSkills(p).includes(nextSkill(p, rng)), 'offered a locked skill')
  }
})

test('nextSkill keeps working once everything available is mastered', () => {
  let p = emptyProgress()
  for (const s of unlockedSkills(p)) p = master(p, s)
  assert.ok(nextSkill(p, seeded(5)), 'a child who has mastered everything still gets practice')
})

test('nextSkill prefers work that is not yet mastered', () => {
  let p = emptyProgress()
  const [first] = unlockedSkills(p)
  p = master(p, first)
  const rng = seeded(3)
  const offered = new Set(Array.from({ length: 40 }, () => nextSkill(p, rng)))
  assert.ok(offered.size > 0)
  assert.ok(!offered.has(first), 'a mastered skill should yield to unmastered work')
})

// ---- spaced repetition ----------------------------------------------------

const answer = (verdict: 'correct' | 'incorrect', at: number) => ({
  problemId: 'a-add-within-10#3,4', skill: 'a-add-within-10' as SkillId,
  factKey: 'add:3+4', given: '7', verdict, elapsedMs: 900, at,
})

test('a fact answered wrong is due again immediately', () => {
  const p = record(emptyProgress(), answer('incorrect', 0))
  assert.ok(dueFacts(p, 1000).includes('add:3+4'), 'a missed fact should come back soon')
})

test('a mastered fact rests before coming round again', () => {
  let p = emptyProgress()
  for (let i = 0; i < 3; i++) p = record(p, answer('correct', 0))
  assert.ok(!dueFacts(p, 1000).includes('add:3+4'), 'a known fact should rest')
  assert.ok(dueFacts(p, 1000 + 60 * 60 * 1000).includes('add:3+4'), 'but must return eventually')
})
