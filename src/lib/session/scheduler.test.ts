import { test } from 'vitest'
import assert from 'node:assert/strict'
import { unlockedSkills, nextSkill, dueFacts, weakestDueFirst, blockedBy } from './scheduler'
import { emptyProgress, record, type Progress } from '@/lib/mastery/mastery'
import { GENERATORS, seeded, type ImplementedSkill } from '@/lib/problems'
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

// ---- targeting facts that are due ----------------------------------------
// dueFacts() has existed and been tested since the scheduler was written, and
// nothing called it — so a missed 7 x 8 never came back. See docs/research.md.

test('a fact records which skill it came from', () => {
  const p = record(emptyProgress(), {
    problemId: 'm-times-6-7-8-9#7,8', skill: 'm-times-6-7-8-9', factKey: 'mul:7x8',
    given: '54', verdict: 'incorrect', elapsedMs: 4000, at: 0,
  })
  assert.equal(p.facts['mul:7x8'].skill, 'm-times-6-7-8-9', 'without this, a due fact cannot be resurfaced')
})

test('due facts come back weakest first', () => {
  let p = emptyProgress()
  // strong: three quick correct answers
  for (let i = 0; i < 3; i++) {
    p = record(p, { problemId: 'a#1', skill: 'm-times-2-5-10', factKey: 'mul:2x3',
      given: '6', verdict: 'correct', elapsedMs: 800, at: 0 })
  }
  // weak: got it wrong
  p = record(p, { problemId: 'b#1', skill: 'm-times-6-7-8-9', factKey: 'mul:7x8',
    given: '54', verdict: 'incorrect', elapsedMs: 5000, at: 0 })

  const due = weakestDueFirst(p, 60 * 60 * 1000)
  assert.equal(due[0], 'mul:7x8', 'the missed fact should be first in the queue')
})

test('nothing is due for a learner with no history', () => {
  assert.deepEqual(weakestDueFirst(emptyProgress(), 1000), [])
})

// ---- explaining a lock ----------------------------------------------------
// A lock with no reason reads as the app being arbitrary. The information
// already existed — effectivePrereqs decides the lock — it just was not shown.

test('an unlocked skill is blocked by nothing', () => {
  assert.deepEqual(blockedBy(emptyProgress(), 'n-bonds-10'), [])
})

test('a locked skill names what would open it', () => {
  assert.deepEqual(blockedBy(emptyProgress(), 'a-add-within-10'), ['n-bonds-10'])
})

test('only the immediate blockers, not the whole chain', () => {
  // Two-step equations sit a long way up, but the learner only needs to be
  // told the next thing — each blocker's own row explains itself.
  const blockers = blockedBy(emptyProgress(), 'p-solve-two-step')
  assert.deepEqual(blockers, ['p-solve-one-step', 'r-negative-add-sub'])
  assert.ok(!blockers.includes('n-bonds-10'), 'the far end of the chain is not actionable')
})

test('a blocker that is already mastered drops off the list', () => {
  let p: Progress = {
    ...emptyProgress(),
    placed: ['n-bonds-10', 'a-add-within-10', 'a-sub-within-10'],
    placementDone: true,
  }
  assert.deepEqual(blockedBy(p, 'a-add-within-20'), [], 'its only prerequisite is done')
  p = { ...p, placed: ['n-bonds-10'] }
  assert.deepEqual(blockedBy(p, 'a-sub-within-20'), ['a-sub-within-10', 'a-add-within-20'])
})

/**
 * Unbuilt prerequisites are stepped over when deciding a lock, so they must be
 * stepped over when explaining one — nobody should be told to go and practise
 * a skill that does not exist.
 */
test('nobody is told to practise something that does not exist', () => {
  const everywhere = Object.keys(GENERATORS) as ImplementedSkill[]
  for (const skill of everywhere) {
    for (const blocker of blockedBy(emptyProgress(), skill)) {
      assert.ok(blocker in GENERATORS, `${skill} is blocked by unbuilt ${blocker}`)
    }
  }
})

test('every locked skill can explain itself', () => {
  const progress = emptyProgress()
  const unlocked = new Set(unlockedSkills(progress))
  for (const skill of Object.keys(GENERATORS) as ImplementedSkill[]) {
    if (unlocked.has(skill)) continue
    assert.ok(blockedBy(progress, skill).length > 0, `${skill} is locked for no stated reason`)
  }
})
