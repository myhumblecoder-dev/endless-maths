// @vitest-environment jsdom
import { test, afterEach, expect, vi } from 'vitest'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SkillMap } from './SkillMap'
import { emptyProgress, record, type Progress } from '@/lib/mastery/mastery'
import type { Pick } from '@/lib/session/weakest'

afterEach(cleanup)

const UP_NEXT: Pick = { skill: 'n-bonds-10', reason: 'new' }

/**
 * A row of the map, found by its text.
 *
 * Not by accessible name: a `listitem` does not take its name from its
 * contents, and an `aria-label` on one is announced inconsistently — which is
 * why everything a reader needs is in the row's own text instead.
 */
function mapRow(label: string): HTMLElement {
  // Past the status glyph, which is decorative but still in the text.
  const found = screen.getAllByRole('listitem')
    .find((li) => (li.textContent ?? '').replace(/^[✓●○\s]+/, '').startsWith(label))
  assert.ok(found, `no row for "${label}"`)
  return found
}

const placed = (...skills: string[]): Progress => ({
  ...emptyProgress(),
  placed: skills as Progress['placed'],
  placementDone: true,
})

/**
 * The app picks the topic. Leaving a tappable list beside that decision would
 * be a lie about who is choosing, so the map became somewhere to look rather
 * than a menu.
 */
test('no topic on the map is tappable', () => {
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)

  const rows = screen.getAllByRole('listitem')
  assert.ok(rows.length > 10, 'the whole map is still shown')
  for (const row of rows) {
    assert.equal(row.querySelector('button'), null,
      `"${row.textContent?.slice(0, 30)}" is still a button`)
  }
})

test('locked topics are still shown, so what is coming stays visible', () => {
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)
  assert.match(mapRow('Two-step equations').textContent ?? '', /locked/)
})

/** Being moved around by an app that will not say why is what grates. */
test('the map names the next topic and why it was chosen', () => {
  render(
    <SkillMap progress={placed()} upNext={{ skill: 'a-add-3digit', reason: 'struggling' }}
      onBack={() => {}} onRetakePlacement={() => {}} now={0} />,
  )
  const next = screen.getByRole('button', { name: /Adding three-digit numbers/ })
  assert.match(next.textContent ?? '', /needs work/i, 'say why, not just what')
})

test('the next topic is the way back to practice', () => {
  const onBack = vi.fn()
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={onBack} onRetakePlacement={() => {}} now={0} />)
  fireEvent.click(screen.getByRole('button', { name: /Number bonds to 10/ }))
  assert.equal(onBack.mock.calls.length, 1)
})

test('mastered skills are marked done', () => {
  render(<SkillMap progress={placed('n-bonds-10')} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)
  const bonds = mapRow('Number bonds to 10')
  assert.match(bonds.textContent ?? '', /done/)
})

/**
 * Placement is a single snapshot. A child who had a bad day is otherwise stuck
 * grinding out of a level that is too easy, with no way back up.
 */
test('placement can be retaken, behind a deliberate second tap', () => {
  const onRetake = vi.fn()
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={onRetake} now={0} />)

  fireEvent.click(screen.getByRole('button', { name: /Change my level/i }))
  assert.equal(onRetake.mock.calls.length, 0, 'one tap must not wipe a level by accident')

  fireEvent.click(screen.getByRole('button', { name: /Yes, retake it/i }))
  assert.equal(onRetake.mock.calls.length, 1)
})

test('the confirmation can be backed out of', () => {
  const onRetake = vi.fn()
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={onRetake} now={0} />)

  fireEvent.click(screen.getByRole('button', { name: /Change my level/i }))
  fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
  assert.equal(onRetake.mock.calls.length, 0)
  expect(screen.getByRole('button', { name: /Change my level/i })).toBeTruthy()
})

test('the map explains that sessions mix in review', () => {
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)
  assert.match(document.body.textContent ?? '', /review/i,
    'a session that silently mixes topics reads as random')
})

test('a skill with facts due says so', () => {
  // The whole prerequisite chain, or the skill is locked and shows no badge.
  const p = record(placed('n-bonds-10', 'a-add-within-10', 'a-add-within-20', 'm-times-2-5-10'), {
    problemId: 'x', skill: 'm-times-2-5-10', factKey: 'mul:5x7',
    given: '30', verdict: 'incorrect', elapsedMs: 4000, at: 0,
  })
  render(<SkillMap progress={p} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={60 * 60 * 1000} />)
  const row = mapRow('The 2, 5 and 10 times tables')
  assert.match(row.textContent ?? '', /1 to review/i, 'due work should be visible before starting')
})

// ---- saying why a topic is locked -----------------------------------------

test('a locked topic says what would unlock it', () => {
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)

  const row = mapRow('Adding to 10')
  assert.match(row.textContent ?? '', /Number bonds to 10/,
    'a lock with no reason reads as the app being arbitrary')
})

/** Greyed-out text is not a channel every reader has. */
test('the reason is in the row itself, not carried by colour alone', () => {
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)
  // Greyed-out text is not a channel every reader has.
  assert.match(mapRow('Adding to 10').textContent ?? '', /Number bonds to 10/)
})

test('only the next step is named, not the whole chain', () => {
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)

  const row = mapRow('Two-step equations')
  assert.match(row.textContent ?? '', /One-step equations|negatives/i)
  assert.doesNotMatch(row.textContent ?? '', /Number bonds/,
    'the far end of the chain is true but useless')
})

test('an unlocked topic says nothing extra', () => {
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)

  const row = mapRow('Number bonds to 10')
  assert.doesNotMatch(row.textContent ?? '', /after|needs/i)
})

// ---- progress worth looking at --------------------------------------------

/** A learner who has practised one skill, mostly getting it right. */
const practised = (skill: string, verdicts: boolean[]): Progress => {
  let p: Progress = { ...placed('n-bonds-10'), placementDone: true }
  verdicts.forEach((ok, i) => {
    p = record(p, {
      problemId: `${skill}#${i}`, skill: skill as Progress['placed'][number],
      given: 'x', verdict: ok ? 'correct' : 'incorrect', elapsedMs: 2000, at: i,
    })
  })
  return p
}

test('a practised topic shows how it is going', () => {
  const p = practised('n-bonds-10', [true, true, true, true, false])
  render(<SkillMap progress={p} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)

  const row = mapRow('Number bonds to 10')
  assert.match(row.textContent ?? '', /80%/, 'a binary tick is thin for an 11-year-old')
})

test('an unpractised topic shows no figures', () => {
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)
  const row = mapRow('Number bonds to 10')
  assert.doesNotMatch(row.textContent ?? '', /%/)
})

test('a trend is shown once there is enough to go on', () => {
  const p = practised('n-bonds-10',
    [false, false, false, false, false, true, true, true, true, true])
  render(<SkillMap progress={p} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)

  const row = mapRow('Number bonds to 10')
  assert.match(row.textContent ?? '', /improving/i)
})

test('the figures are factual, not praise or blame', () => {
  const p = practised('n-bonds-10', [true, true, true, true, true, true, true, true])
  render(<SkillMap progress={p} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)

  const body = document.body.textContent ?? ''
  for (const word of ['well done', 'great', 'poor', 'bad', 'oops', 'amazing']) {
    assert.ok(!new RegExp(word, 'i').test(body), `"${word}" is judgement, not information`)
  }
})

test('accuracy is in the accessible name too', () => {
  const p = practised('n-bonds-10', [true, true, true, true, false])
  render(<SkillMap progress={p} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}} now={0} />)
  assert.match(mapRow('Number bonds to 10').textContent ?? '', /80%/)
})

// ---- session length -------------------------------------------------------

test('the session length can be chosen and is highlighted', () => {
  const onLength = vi.fn()
  render(<SkillMap progress={placed()} upNext={UP_NEXT} onBack={() => {}} onRetakePlacement={() => {}}
    onSessionLength={onLength} now={0} />)

  const forty = screen.getByRole('button', { name: /40 questions/ })
  fireEvent.click(forty)
  assert.deepEqual(onLength.mock.calls, [[40]])
})

test('the current length is marked as selected', () => {
  render(<SkillMap progress={{ ...placed(), sessionLength: 10 }} upNext={UP_NEXT} onBack={() => {}}
    onRetakePlacement={() => {}} onSessionLength={() => {}} now={0} />)

  const ten = screen.getByRole('button', { name: /10 questions/ })
  assert.equal(ten.getAttribute('aria-pressed'), 'true')
  assert.equal(screen.getByRole('button', { name: /20 questions/ }).getAttribute('aria-pressed'), 'false')
})
