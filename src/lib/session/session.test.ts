import { test } from 'vitest'
import assert from 'node:assert/strict'
import { startSession, currentProblem, answer, isComplete, summary, completesProblem, SESSION_LENGTH } from './session'
import { unlockedSkills } from './scheduler'
import { emptyProgress, record, type Progress } from '@/lib/mastery/mastery'
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
  const s = startSession(emptyProgress(), seeded(3), { length: 60 })
  assert.equal(s.problems.length, 60)
})

test('variety does not cost reproducibility', () => {
  const a = startSession(emptyProgress(), seeded(11)).problems.map((p) => p.prompt)
  const b = startSession(emptyProgress(), seeded(11)).problems.map((p) => p.prompt)
  assert.deepEqual(a, b)
})

// ---- choosing a skill -----------------------------------------------------

test('a session is built around the chosen skill', () => {
  // Superseded by the interleaving tests below: the session is no longer 100%
  // the chosen skill, but it is still anchored on it.
  const s = startSession({ ...emptyProgress(), placed: ['n-bonds-10', 'a-add-within-10'] },
    seeded(5), { skill: 'a-add-within-20' })
  assert.equal(s.problems.length, SESSION_LENGTH)
  const chosen = s.problems.filter((p) => p.skill === 'a-add-within-20').length
  assert.ok(chosen >= SESSION_LENGTH / 2, `chosen skill was only ${chosen} of ${SESSION_LENGTH}`)
})

test('a focused session still avoids repeating a question', () => {
  const s = startSession(emptyProgress(), seeded(9), { skill: 'n-place-value-100' })
  const prompts = s.problems.map((p) => p.prompt)
  assert.equal(new Set(prompts).size, prompts.length)
})

test('an explicit length is still honoured', () => {
  assert.equal(startSession(emptyProgress(), seeded(3), { length: 5 }).problems.length, 5)
})

// ---- interleaving ---------------------------------------------------------
// A session used to be 100% one skill, which is blocked practice — the weaker
// option per Sparx and the retrieval literature. See docs/research.md.

/** A learner who has mastered a few skills, so there is review to draw on. */
const experienced = () => ({
  ...emptyProgress(),
  placed: ['n-bonds-10', 'n-compare-20', 'n-place-value-100', 'a-add-within-10',
           'a-sub-within-10', 'a-add-within-20'] as const,
  placementDone: true,
})

test('a session interleaves rather than drilling one skill', () => {
  const s = startSession({ ...emptyProgress(), ...experienced(), placed: [...experienced().placed] },
    seeded(5), { skill: 'a-sub-within-20' })
  const skills = new Set(s.problems.map((p) => p.skill))
  assert.ok(skills.size > 1, 'a session of one skill is blocked practice')
})

test('the chosen skill is always the largest share', () => {
  for (const seed of [1, 2, 3, 11, 42]) {
    const s = startSession({ ...experienced(), placed: [...experienced().placed] },
      seeded(seed), { skill: 'a-sub-within-20' })
    const counts = new Map<string, number>()
    for (const p of s.problems) counts.set(p.skill, (counts.get(p.skill) ?? 0) + 1)
    const chosen = counts.get('a-sub-within-20') ?? 0
    for (const [skill, n] of counts) {
      if (skill !== 'a-sub-within-20') {
        assert.ok(chosen > n, `seed ${seed}: ${skill} (${n}) beat the chosen skill (${chosen})`)
      }
    }
  }
})

test('roughly half the session is the chosen skill', () => {
  for (const seed of [1, 7, 20]) {
    const s = startSession({ ...experienced(), placed: [...experienced().placed] },
      seeded(seed), { skill: 'a-sub-within-20' })
    const chosen = s.problems.filter((p) => p.skill === 'a-sub-within-20').length
    assert.ok(chosen >= 8 && chosen <= 14, `seed ${seed}: chosen skill took ${chosen} of 20`)
  }
})

test('a learner with nothing mastered still gets a full session', () => {
  // Nothing to review, so it degrades to the chosen skill rather than falling short.
  const s = startSession(emptyProgress(), seeded(3), { skill: 'n-bonds-10' })
  assert.equal(s.problems.length, SESSION_LENGTH)
})

test('interleaving does not break the existing variety rules', () => {
  for (const seed of [1, 5, 9, 30]) {
    const s = startSession({ ...experienced(), placed: [...experienced().placed] },
      seeded(seed), { skill: 'a-sub-within-20' })
    const prompts = s.problems.map((p) => p.prompt)
    assert.equal(new Set(prompts).size, prompts.length, `seed ${seed} repeated a question`)
    const skills = s.problems.map((p) => p.skill)
    for (let i = 2; i < skills.length; i++) {
      assert.ok(!(skills[i] === skills[i - 1] && skills[i] === skills[i - 2]),
        `seed ${seed}: three ${skills[i]} in a row`)
    }
  }
})

test('interleaving stays reproducible from its seed', () => {
  const run = () => startSession({ ...experienced(), placed: [...experienced().placed] },
    seeded(77), { skill: 'a-sub-within-20' }).problems.map((p) => `${p.skill}:${p.prompt}`)
  assert.deepEqual(run(), run())
})

// ---- spaced repetition in a session --------------------------------------
// The whole point of tracking facts: a missed one has to come back.

const HOUR = 60 * 60 * 1000

/** Someone who has practised the easy tables and just got 7 x 8 wrong. */
function missedSevenEights(): Progress {
  let p: Progress = {
    ...emptyProgress(),
    placed: ['n-bonds-10', 'a-add-within-10', 'a-sub-within-10', 'a-add-within-20',
             'm-times-2-5-10', 'm-times-3-4', 'm-times-6-7-8-9'],
    placementDone: true,
  }
  p = record(p, {
    problemId: 'm-times-6-7-8-9#7,8', skill: 'm-times-6-7-8-9', factKey: 'mul:7x8',
    given: '54', verdict: 'incorrect', elapsedMs: 5000, at: 0,
  })
  return p
}

test('a fact answered wrong comes back', () => {
  const progress = missedSevenEights()
  let seen = false
  // Two sessions, as the acceptance criteria allow.
  for (const seed of [11, 12]) {
    const s = startSession(progress, seeded(seed), { skill: 'a-add-within-20', now: HOUR })
    if (s.problems.some((p) => p.factKey === 'mul:7x8')) seen = true
  }
  assert.ok(seen, '7 x 8 was missed and never came back — spaced repetition is not wired up')
})

test('a fact just answered correctly is not asked again immediately', () => {
  let progress = missedSevenEights()
  // Three quick correct answers: now mastered, and should rest.
  for (let i = 0; i < 3; i++) {
    progress = record(progress, {
      problemId: 'm-times-6-7-8-9#7,8', skill: 'm-times-6-7-8-9', factKey: 'mul:7x8',
      given: '56', verdict: 'correct', elapsedMs: 900, at: HOUR,
    })
  }
  const s = startSession(progress, seeded(5), { skill: 'a-add-within-20', now: HOUR + 1000 })
  assert.ok(!s.problems.some((p) => p.factKey === 'mul:7x8'), 'a fact just mastered should rest')
})

test('review falls back to a normal draw when nothing is due', () => {
  const progress: Progress = {
    ...emptyProgress(),
    placed: ['n-bonds-10', 'a-add-within-10', 'a-sub-within-10', 'a-add-within-20'],
    placementDone: true,
  }
  const s = startSession(progress, seeded(8), { skill: 'a-add-within-20', now: HOUR })
  assert.equal(s.problems.length, SESSION_LENGTH)
  assert.ok(new Set(s.problems.map((p) => p.skill)).size > 1, 'still interleaves without due facts')
})

test('targeting due facts stays reproducible from the seed', () => {
  const progress = missedSevenEights()
  const run = () => startSession(progress, seeded(3), { skill: 'a-add-within-20', now: HOUR })
    .problems.map((p) => `${p.skill}:${p.prompt}`)
  assert.deepEqual(run(), run())
})

test('an unsimplified answer does not finish the problem', () => {
  // The policy is "right, now simplify it" — so the learner stays on the
  // question rather than being moved past a half-finished answer.
  assert.equal(completesProblem('correct'), true)
  assert.equal(completesProblem('incorrect'), true)
  assert.equal(completesProblem('equivalent-unsimplified'), false)
})
