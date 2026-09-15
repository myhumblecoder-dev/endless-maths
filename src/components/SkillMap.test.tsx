// @vitest-environment jsdom
import { test, afterEach, expect, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SkillMap } from './SkillMap'
import { emptyProgress, record, type Progress } from '@/lib/mastery/mastery'

afterEach(cleanup)

const placed = (...skills: string[]): Progress => ({
  ...emptyProgress(),
  placed: skills as Progress['placed'],
  placementDone: true,
})

test('unlocked skills can be chosen', () => {
  const onPick = vi.fn()
  render(<SkillMap progress={placed()} onPick={onPick} onRetakePlacement={() => {}} now={0} />)

  fireEvent.click(screen.getByRole('button', { name: /^Number bonds to 10/ }))
  assert.deepEqual(onPick.mock.calls, [['n-bonds-10']])
})

test('locked skills are visible but cannot be chosen', () => {
  const onPick = vi.fn()
  render(<SkillMap progress={placed()} onPick={onPick} onRetakePlacement={() => {}} now={0} />)

  const locked = screen.getByRole('button', { name: /^Two-step equations \(locked/ }) as HTMLButtonElement
  assert.equal(locked.disabled, true, 'locks are hard — seeing what is coming must not mean tapping into it')
  fireEvent.click(locked)
  assert.equal(onPick.mock.calls.length, 0)
})

test('mastered skills are marked done', () => {
  render(<SkillMap progress={placed('n-bonds-10')} onPick={() => {}} onRetakePlacement={() => {}} now={0} />)
  const bonds = screen.getByRole('button', { name: /^Number bonds to 10/ })
  assert.match(bonds.textContent ?? '', /done/)
})

/**
 * Placement is a single snapshot. A child who had a bad day is otherwise stuck
 * grinding out of a level that is too easy, with no way back up.
 */
test('placement can be retaken, behind a deliberate second tap', () => {
  const onRetake = vi.fn()
  render(<SkillMap progress={placed()} onPick={() => {}} onRetakePlacement={onRetake} now={0} />)

  fireEvent.click(screen.getByRole('button', { name: /Change my level/i }))
  assert.equal(onRetake.mock.calls.length, 0, 'one tap must not wipe a level by accident')

  fireEvent.click(screen.getByRole('button', { name: /Yes, retake it/i }))
  assert.equal(onRetake.mock.calls.length, 1)
})

test('the confirmation can be backed out of', () => {
  const onRetake = vi.fn()
  render(<SkillMap progress={placed()} onPick={() => {}} onRetakePlacement={onRetake} now={0} />)

  fireEvent.click(screen.getByRole('button', { name: /Change my level/i }))
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
  assert.equal(onRetake.mock.calls.length, 0)
  expect(screen.getByRole('button', { name: /Change my level/i })).toBeTruthy()
})

test('the map explains that sessions mix in review', () => {
  render(<SkillMap progress={placed()} onPick={() => {}} onRetakePlacement={() => {}} now={0} />)
  assert.match(document.body.textContent ?? '', /review/i,
    'a session that silently mixes topics reads as random')
})

test('a skill with facts due says so', () => {
  // The whole prerequisite chain, or the skill is locked and shows no badge.
  const p = record(placed('n-bonds-10', 'a-add-within-10', 'a-add-within-20', 'm-times-2-5-10'), {
    problemId: 'x', skill: 'm-times-2-5-10', factKey: 'mul:5x7',
    given: '30', verdict: 'incorrect', elapsedMs: 4000, at: 0,
  })
  render(<SkillMap progress={p} onPick={() => {}} onRetakePlacement={() => {}} now={60 * 60 * 1000} />)
  const row = screen.getByRole('button', { name: /^The 2, 5 and 10 times tables/ })
  assert.match(row.textContent ?? '', /1 to review/i, 'due work should be visible before starting')
})

// ---- saying why a topic is locked -----------------------------------------

test('a locked topic says what would unlock it', () => {
  render(<SkillMap progress={placed()} onPick={() => {}} onRetakePlacement={() => {}} now={0} />)

  const row = screen.getByRole('button', { name: /^Adding to 10/ })
  assert.match(row.textContent ?? '', /Number bonds to 10/,
    'a lock with no reason reads as the app being arbitrary')
})

test('the reason is part of the accessible name, not just colour', () => {
  render(<SkillMap progress={placed()} onPick={() => {}} onRetakePlacement={() => {}} now={0} />)
  // Screen readers and greyed text are not the same channel.
  expect(screen.getByRole('button', { name: /^Adding to 10.*Number bonds to 10/ })).toBeTruthy()
})

test('only the next step is named, not the whole chain', () => {
  render(<SkillMap progress={placed()} onPick={() => {}} onRetakePlacement={() => {}} now={0} />)

  const row = screen.getByRole('button', { name: /^Two-step equations/ })
  assert.match(row.textContent ?? '', /One-step equations|negatives/i)
  assert.doesNotMatch(row.textContent ?? '', /Number bonds/,
    'the far end of the chain is true but useless')
})

test('an unlocked topic says nothing extra', () => {
  render(<SkillMap progress={placed()} onPick={() => {}} onRetakePlacement={() => {}} now={0} />)

  const row = screen.getByRole('button', { name: /^Number bonds to 10/ })
  assert.doesNotMatch(row.textContent ?? '', /after|needs/i)
})
