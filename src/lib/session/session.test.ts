import { test } from 'vitest'
import assert from 'node:assert/strict'
import { startSession, currentProblem, answer, isComplete, summary, SESSION_LENGTH } from './session'
import { unlockedSkills } from './scheduler'
import { emptyProgress } from '@/lib/mastery/mastery'
import { seeded } from '@/lib/problems'

const start = () => startSession(emptyProgress(), seeded(42))

/** Answer the current problem correctly, whatever it is. */
function answerCorrectly(s: ReturnType<typeof start>, elapsedMs = 1000) {
  const p = currentProblem(s)
  assert.ok(p, 'expected a current problem')
  const a = p.answer
  const given =
    a.kind === 'integer' ? String(a.value)
    : a.kind === 'decimal' ? a.value.toFixed(a.dp)
    : a.kind === 'choice' ? a.value
    : ''
  return answer(s, given, elapsedMs, Date.now())
}

test('a session is bounded — endless supply, finite session', () => {
  assert.equal(SESSION_LENGTH, 20)
  assert.equal(startSession(emptyProgress(), seeded(1)).problems.length, SESSION_LENGTH)
})

test('a session only draws on unlocked skills', () => {
  const unlocked = unlockedSkills(emptyProgress())
  for (const p of start().problems) {
    assert.ok(unlocked.includes(p.skill as (typeof unlocked)[number]), `${p.skill} is locked`)
  }
})

test('a fresh session starts at the first problem and is not complete', () => {
  const s = start()
  assert.equal(s.index, 0)
  assert.equal(isComplete(s), false)
  assert.ok(currentProblem(s))
})

test('answering advances to the next problem', () => {
  const s = start()
  const first = currentProblem(s)
  assert.ok(first)
  const next = answerCorrectly(s)
  assert.equal(next.index, 1)
  assert.notEqual(currentProblem(next)?.id, undefined)
})

test('answering does not mutate the session passed in', () => {
  const s = start()
  answerCorrectly(s)
  assert.equal(s.index, 0, 'answer must be pure')
  assert.equal(s.attempts.length, 0)
})

test('a correct answer is graded correct and recorded', () => {
  const next = answerCorrectly(start())
  assert.equal(next.attempts.length, 1)
  assert.equal(next.attempts[0].verdict, 'correct')
})

test('a wrong answer is graded incorrect', () => {
  const s = answer(start(), 'definitely not the answer', 1000, 0)
  assert.equal(s.attempts[0].verdict, 'incorrect')
})

test('answering feeds mastery progress', () => {
  const s = answerCorrectly(start())
  const skill = s.attempts[0].skill
  assert.equal(s.progress.skills[skill]?.attempts, 1)
})

test('the session completes after exactly SESSION_LENGTH answers', () => {
  let s = start()
  for (let i = 0; i < SESSION_LENGTH; i++) {
    assert.equal(isComplete(s), false, `completed early at ${i}`)
    s = answerCorrectly(s)
  }
  assert.equal(isComplete(s), true)
})

test('summary counts what happened', () => {
  let s = start()
  for (let i = 0; i < 5; i++) s = answerCorrectly(s)
  s = answer(s, 'wrong', 1000, 0)
  const r = summary(s)
  assert.equal(r.answered, 6)
  assert.equal(r.correct, 5)
  assert.equal(r.total, SESSION_LENGTH)
})

test('currentProblem is undefined once the session is done', () => {
  let s = start()
  for (let i = 0; i < SESSION_LENGTH; i++) s = answerCorrectly(s)
  assert.equal(currentProblem(s), undefined)
})

test('the same seed replays the same session', () => {
  const a = startSession(emptyProgress(), seeded(7)).problems.map((p) => p.prompt)
  const b = startSession(emptyProgress(), seeded(7)).problems.map((p) => p.prompt)
  assert.deepEqual(a, b, 'a teacher must be able to hand the same set to a class')
})

test('elapsed time is carried through to the attempt', () => {
  const s = answerCorrectly(start(), 2500)
  assert.equal(s.attempts[0].elapsedMs, 2500)
})

// ---- variety --------------------------------------------------------------
// Uniform random over the unlocked skills produced six number bonds in a row
// and the same question twice. Both read as "this app is broken".

test('a session does not ask the same question twice', () => {
  for (const seed of [1234, 7, 99, 20260914]) {
    const prompts = startSession(emptyProgress(), seeded(seed)).problems.map((p) => p.prompt)
    assert.equal(new Set(prompts).size, prompts.length, `seed ${seed} repeated a question`)
  }
})

test('a session does not run the same skill more than twice in a row', () => {
  for (const seed of [1234, 7, 99, 20260914]) {
    const skills = startSession(emptyProgress(), seeded(seed)).problems.map((p) => p.skill)
    for (let i = 2; i < skills.length; i++) {
      assert.ok(
        !(skills[i] === skills[i - 1] && skills[i] === skills[i - 2]),
        `seed ${seed}: three ${skills[i]} in a row at ${i + 1}`,
      )
    }
  }
})

test('a session still fills up when the available pool is small', () => {
  // n-bonds-10 has only nine possible questions; asking for sixty problems
  // must degrade to repeats rather than hang or throw.
  const s = startSession(emptyProgress(), seeded(3), 60)
  assert.equal(s.problems.length, 60)
})

test('variety does not cost reproducibility', () => {
  const a = startSession(emptyProgress(), seeded(11)).problems.map((p) => p.prompt)
  const b = startSession(emptyProgress(), seeded(11)).problems.map((p) => p.prompt)
  assert.deepEqual(a, b)
})
