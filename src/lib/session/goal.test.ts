import { test } from 'vitest'
import assert from 'node:assert/strict'
import { goalOf, SESSION_CAP, SESSION_WINDOW, ACCURACY } from './goal'

/** `n` answers, the last `wrong` of them incorrect. */
const run = (n: number, wrong: number[] = []): boolean[] =>
  Array.from({ length: n }, (_, i) => !wrong.includes(i))

const after = (verdicts: boolean[], minimum = 20) => goalOf(verdicts, minimum)

test('a session is not finished before the minimum, however well it is going', () => {
  const g = after(run(19))
  assert.equal(g.done, false)
  assert.equal(g.remaining, 1, 'nineteen perfect answers still leaves one')
})

test('twenty right out of twenty finishes', () => {
  const g = after(run(20))
  assert.equal(g.done, true)
  assert.equal(g.remaining, 0)
})

/** 90% of twenty is eighteen, so two wrong is still a pass. */
test('two wrong in twenty still finishes', () => {
  assert.equal(after(run(20, [3, 11])).done, true)
})

test('three wrong in twenty does not finish', () => {
  const g = after(run(20, [3, 11, 17]))
  assert.equal(g.done, false)
  assert.ok(g.remaining > 0, 'and it says how many more')
})

/**
 * The finish line moves with them rather than away from them. A wrong answer
 * eventually leaves the window, so the work needed is bounded by how long ago
 * the mistakes were — not by how many there have been in total.
 */
test('wrong answers stop counting once they fall out of the window', () => {
  // Five wrong right at the start, then a clean run.
  const verdicts = [...run(5, [0, 1, 2, 3, 4]), ...run(20)]
  assert.equal(after(verdicts).done, true, 'a bad start is survivable')
})

test('a session going badly says exactly how much is left', () => {
  const verdicts = run(20, [15, 17, 19])
  const g = after(verdicts)
  assert.equal(g.done, false)
  // Three mistakes, and the oldest of them is only five answers back — so it
  // takes sixteen more to push it out of a twenty-answer window. Recent
  // mistakes cost MORE than old ones, which is the point of the window.
  assert.equal(g.remaining, 16)
})

test('the count to go shrinks as they get them right', () => {
  let verdicts = run(20, [17, 18, 19])
  const first = after(verdicts).remaining
  verdicts = [...verdicts, true, true]
  assert.ok(after(verdicts).remaining < first, 'improving must pull the finish line closer')
})

test('a wrong answer pushes the finish line out', () => {
  const struggling = run(25, [20, 22, 24])
  const steady = after(struggling).remaining
  const slipped = after([...struggling, false]).remaining
  assert.ok(slipped > steady,
    `getting one wrong must cost something (was ${steady}, now ${slipped})`)
})

/** The other half of the same rule: an old mistake costs less than a new one. */
test('a mistake gets cheaper the further back it is', () => {
  const justNow = after(run(20, [17, 18, 19])).remaining
  const longAgo = after(run(20, [5, 6, 7])).remaining
  assert.ok(longAgo < justNow, `${longAgo} should be less than ${justNow}`)
})

// ---- the cap ---------------------------------------------------------------

/**
 * Cumulative 90% needs `total >= 10 * wrong`, so below 90% accuracy the finish
 * line recedes faster than the learner approaches it. Simulated at 80%, three
 * sessions in four never end. The cap is what makes the rule survivable, and
 * the rolling window is what makes it reachable.
 */
test('the session stops at the cap even if the goal was never met', () => {
  const g = after(run(SESSION_CAP, [55, 56, 57, 58, 59]))
  assert.equal(g.over, true, 'nobody is kept here forever')
  assert.equal(g.done, false, 'but it is not a pass')
  assert.equal(g.reachedCap, true)
})

test('the cap is not reported before it is reached', () => {
  assert.equal(after(run(SESSION_CAP - 1, [55, 56, 57])).reachedCap, false)
})

test('meeting the goal at the cap is a pass, not a cap', () => {
  const g = after(run(SESSION_CAP))
  assert.equal(g.done, true)
  assert.equal(g.reachedCap, false, 'they finished — the cap never bit')
})

test('the count to go never promises more questions than the cap allows', () => {
  const g = after(run(58, [55, 56, 57]))
  assert.ok(g.remaining <= SESSION_CAP - 58, 'a promise the session cannot keep is a lie')
})

// ---- a shorter run ---------------------------------------------------------

/**
 * The learner can still choose a shorter session. The rule scales with it:
 * 90% of ten is nine, so one wrong is a pass and two is not.
 */
test('a ten-question session needs nine of the last ten', () => {
  assert.equal(goalOf(run(10, [4]), 10).done, true)
  assert.equal(goalOf(run(10, [4, 8]), 10).done, false)
})

// ---- what the learner is shown ---------------------------------------------

test('progress is reported as right-out-of-window, which is what the rule is', () => {
  const g = after(run(24, [20, 23]))
  assert.equal(g.window, SESSION_WINDOW)
  assert.equal(g.right, 18)
  assert.equal(g.required, Math.ceil(SESSION_WINDOW * ACCURACY))
})

test('before the window is full, it reports on what there is', () => {
  const g = after(run(6, [2]))
  assert.equal(g.window, 6)
  assert.equal(g.right, 5)
})

test('no answers yet is a well-formed state rather than a divide by zero', () => {
  const g = after([])
  assert.equal(g.done, false)
  assert.equal(g.right, 0)
  assert.equal(g.remaining, 20)
  assert.ok(Number.isFinite(g.required))
})
