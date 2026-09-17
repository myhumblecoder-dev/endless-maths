import { test } from 'vitest'
import assert from 'node:assert/strict'
import { startSession } from './session'
import { setDifficulty } from '@/lib/mastery/levels'
import { emptyProgress } from '@/lib/mastery/mastery'
import { seeded } from '@/lib/problems'
import type { SkillId } from '@/lib/curriculum/types'

const placed = (...skills: SkillId[]) => ({
  ...emptyProgress(), placementDone: true, placed: skills,
})

/** Does adding these two carry in any column? That is what `simple` removes. */
function carries(a: number, b: number): boolean {
  let carry = 0
  for (let place = 1; place <= 100; place *= 10) {
    const sum = (Math.floor(a / place) % 10) + (Math.floor(b / place) % 10) + carry
    carry = sum >= 10 ? 1 : 0
    if (carry) return true
  }
  return false
}

/**
 * The whole point of levels. A child who ran out of questions is TOLD the next
 * lot will start gentler — and the stored level was reaching the picker and the
 * announcement but never a generator, so they were handed the identical
 * questions. A promise the app does not keep is worse than no promise.
 */
test('a topic dropped to simple is actually asked at simple', () => {
  const p = setDifficulty(
    placed('n-bonds-10', 'n-place-value-100', 'n-place-value-1000',
      'a-add-within-10', 'a-add-within-20', 'a-add-2digit', 'a-add-2digit-regroup', 'a-add-3digit'),
    'a-add-3digit', 'simple',
  )

  const s = startSession(p, seeded(77), { skill: 'a-add-3digit', now: 0 })
  const focus = s.problems.filter((q) => q.skill === 'a-add-3digit')
  assert.ok(focus.length > 5, 'the session should be mostly the topic in hand')

  for (const q of focus) {
    const [a, b] = q.operands
    assert.equal(carries(a, b), false, `"${q.prompt}" carries — that is not the simple version`)
  }
})

test('a topic taken to difficult is actually asked at difficult', () => {
  const p = setDifficulty(
    placed('n-bonds-10', 'n-place-value-100', 'n-place-value-1000',
      'a-add-within-10', 'a-add-within-20', 'a-add-2digit', 'a-add-2digit-regroup', 'a-add-3digit'),
    'a-add-3digit', 'difficult',
  )

  const s = startSession(p, seeded(77), { skill: 'a-add-3digit', now: 0 })
  const focus = s.problems.filter((q) => q.skill === 'a-add-3digit')
  for (const q of focus) {
    assert.equal(carries(q.operands[0], q.operands[1]), true,
      `"${q.prompt}" does not carry — that is not the hard version`)
  }
})

/** Review and stretch are topics too, each with a level of their own. */
test('the level follows every topic in the mix, not just the one in hand', () => {
  const p = setDifficulty(
    placed('n-bonds-10', 'n-place-value-100', 'n-place-value-1000', 'n-round',
      'a-add-within-10', 'a-add-within-20'),
    'n-round', 'simple',
  )
  const s = startSession(p, seeded(5), { skill: 'a-add-within-20', now: 0 })
  const rounding = s.problems.filter((q) => q.skill === 'n-round')
  for (const q of rounding) {
    assert.match(q.prompt, /nearest 10$/,
      `"${q.prompt}" is not the simple version of rounding`)
  }
})

test('a topic with no stored level is asked at the usual one', () => {
  const p = placed('n-bonds-10', 'n-place-value-100', 'n-place-value-1000',
    'a-add-within-10', 'a-add-within-20', 'a-add-2digit', 'a-add-2digit-regroup', 'a-add-3digit')
  const withLevel = startSession(p, seeded(9), { skill: 'a-add-3digit', now: 0 })
  const same = startSession(
    setDifficulty(p, 'a-add-3digit', 'medium'), seeded(9), { skill: 'a-add-3digit', now: 0 })
  assert.deepEqual(
    withLevel.problems.map((q) => q.prompt),
    same.problems.map((q) => q.prompt),
  )
})
