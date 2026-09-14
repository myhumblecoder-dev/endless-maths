// @vitest-environment jsdom
import { test, afterEach, expect, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SkillMap } from './SkillMap'
import { emptyProgress, type Progress } from '@/lib/mastery/mastery'

afterEach(cleanup)

const placed = (...skills: string[]): Progress => ({
  ...emptyProgress(),
  placed: skills as Progress['placed'],
  placementDone: true,
})

test('unlocked skills can be chosen', () => {
  const onPick = vi.fn()
  render(<SkillMap progress={placed()} onPick={onPick} onRetakePlacement={() => {}} />)

  fireEvent.click(screen.getByRole('button', { name: /Number bonds to 10/ }))
  assert.deepEqual(onPick.mock.calls, [['n-bonds-10']])
})

test('locked skills are visible but cannot be chosen', () => {
  const onPick = vi.fn()
  render(<SkillMap progress={placed()} onPick={onPick} onRetakePlacement={() => {}} />)

  const locked = screen.getByRole('button', { name: /Two-step equations \(locked\)/ }) as HTMLButtonElement
  assert.equal(locked.disabled, true, 'locks are hard — seeing what is coming must not mean tapping into it')
  fireEvent.click(locked)
  assert.equal(onPick.mock.calls.length, 0)
})

test('mastered skills are marked done', () => {
  render(<SkillMap progress={placed('n-bonds-10')} onPick={() => {}} onRetakePlacement={() => {}} />)
  const bonds = screen.getByRole('button', { name: /Number bonds to 10/ })
  assert.match(bonds.textContent ?? '', /done/)
})

/**
 * Placement is a single snapshot. A child who had a bad day is otherwise stuck
 * grinding out of a level that is too easy, with no way back up.
 */
test('placement can be retaken, behind a deliberate second tap', () => {
  const onRetake = vi.fn()
  render(<SkillMap progress={placed()} onPick={() => {}} onRetakePlacement={onRetake} />)

  fireEvent.click(screen.getByRole('button', { name: /Change my level/i }))
  assert.equal(onRetake.mock.calls.length, 0, 'one tap must not wipe a level by accident')

  fireEvent.click(screen.getByRole('button', { name: /Yes, start the questions again/i }))
  assert.equal(onRetake.mock.calls.length, 1)
})

test('the confirmation can be backed out of', () => {
  const onRetake = vi.fn()
  render(<SkillMap progress={placed()} onPick={() => {}} onRetakePlacement={onRetake} />)

  fireEvent.click(screen.getByRole('button', { name: /Change my level/i }))
  fireEvent.click(screen.getByRole('button', { name: /No, keep going/i }))
  assert.equal(onRetake.mock.calls.length, 0)
  expect(screen.getByRole('button', { name: /Change my level/i })).toBeTruthy()
})
