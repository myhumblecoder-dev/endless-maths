# Prior art — what others have done

Researched September 2026, prompted by the audience turning out to be 11 and 13
rather than primary age. Two findings reversed earlier decisions in
`design.md`; both are marked below.

## Math input is a solved problem — and cheaper than assumed

**[MathLive](https://mathlive.io/mathfield/guides/react/)** is an MIT-licensed
`<math-field>` web component: TeX-quality rendering, a virtual keyboard for
touch, physical-keyboard shortcuts, and export to LaTeX, MathML, ASCIIMath or
**MathJSON**. Actively maintained (0.110.0, released mid-2026), used by 270+
packages, documented React integration.

Alternatives considered and rejected:

- **[Khan Academy's `math-input`](https://github.com/Khan/math-input)** — the
  obvious reference implementation, but archived January 2023; development moved
  inside their Perseus monorepo and it is no longer a standalone package.
- **[MathQuill](https://github.com/mathquill/mathquill)** — older, and its own
  README describes development as *resuming*, which means it had stalled.

> **Reverses `design.md`.** The implementation tiers called the expression
> engine "the worst return in the project" and advised deferring it
> indefinitely, on the basis that expression input plus a canonicaliser was the
> largest single piece of work. MathLive supplies the input, and MathJSON
> supplies canonical comparison — so `3 + 5x` matching `5x + 3` stops being
> something we write. The three Tier 3 skills (collecting like terms, expanding
> brackets, inequalities) are squarely Year 8–9 material for a 13-year-old, so
> the cost fell and the value rose at the same time.

**Spiked September 2026 — and the conclusion reversed again. See below.**

**Not** needed for fractions. A two-box numerator/denominator input is simpler,
faster to tap, and unambiguous.

### Spike result: don't adopt it

Built a throwaway page against MathLive 0.110.0 and measured it.

**What worked.** Rendering is excellent, the `<math-field>` element behaves, and
a client-only dynamic import keeps it off the critical path — the 795 KB chunk
appeared in *neither* route's initial HTML. 222 KB gzipped, lazily loaded.

**What killed it.** `getValue('math-json')` returns
`["Error", "compute-engine-not-available"]`. MathJSON needs a **separate**
package, `@cortex-js/compute-engine`, which MathLive does not bundle — and
canonical comparison was the entire reason to adopt MathLive:

| | gzipped |
| --- | --- |
| mathlive | 222 KB |
| compute-engine `core.js` | **859 KB** |
| compute-engine chunk | **645 KB** |
| fonts + sounds (runtime fetch) | 536 KB raw |

Roughly 1.5 MB gzipped of computer-algebra system, to grade three skills.

**What to do instead.** The answers these skills need are not arbitrary maths —
they are linear expressions in one variable: `7x + 5`, `6x + 15`, `x > 5`. That
needs an extended keypad (digits, `x`, `+`, `−`, and the relations) and a small
normaliser of our own, not a CAS. Perhaps a hundred lines, fully testable,
entirely under our control, and no dependency at all.

The original tier analysis called the expression engine expensive because we
would write the canonicaliser ourselves. Then MathLive appeared to remove that
cost. The spike shows it does not — but the honest answer is that the
canonicaliser was never the hard part, because the grammar is tiny. Writing it
is cheaper than either alternative.

## Accepting unsimplified answers is a real differentiator

Khan Academy is
[inconsistent about this](https://support.khanacademy.org/hc/en-us/community/posts/25103991131149-Simplifying-answers):
some questions in the same lesson demand a simplified fraction, others accept
`10/1` for `10`, and students get marked wrong for answers that are
mathematically correct. It is a long-standing complaint.

This settles the open question in `design.md`. `Verdict` already has three
states; `equivalent-unsimplified` should tell the learner the answer is right
but not finished, and never score it as wrong.

## Blocked practice is the wrong default

**[Sparx Maths](https://sparxmaths.com/)** (ages 11–16, efficacy trial with the
University of Cambridge) personalises per pupil, requires 100% correct before a
task is complete, targets ~60 minutes a week, and deliberately **mixes in
questions from previously covered topics**.

The underlying evidence is
[spaced retrieval and interleaving](https://www.structural-learning.com/post/mathswatch):
Donoghue & Hattie's review of 242 studies (169,179 participants) puts practice
testing and distributed practice among the best-supported strategies, and Rohrer
& Taylor found interleaved problem types beat blocked practice. A practical
recipe quoted there: *three questions from the last lesson, two from an older
topic, one from the next* — roughly 50% current, 33% review, 17% new.

> **Reverses the current implementation.** A focused session is 100% one skill,
> which is blocked practice — the option the research says is worse. The
> `dueFacts()` scheduler already exists and is tested; nothing calls it. Wiring
> it up is now a correctness issue, not a nice-to-have.

## Tone for 11–13

Streaks and gamification do raise engagement, but the reviews flag
overreliance on extrinsic reward as a known failure mode, and intrinsic
motivation is what correlates with achievement. The most transferable line is
that frequent retrieval should *feel like practice, not constant judgement*.

Applied here: trophy and star emoji dropped, "✓ Yes!" became "Correct",
"It's 6" became "Answer: 6", the summary is a plain `18/20` with seconds per
question, and the crash screen lost its emoji. Immediate feedback is kept —
that part is well supported.

## Sources

- https://mathlive.io/mathfield/guides/react/
- https://github.com/Khan/math-input
- https://github.com/mathquill/mathquill
- https://support.khanacademy.org/hc/en-us/community/posts/25103991131149-Simplifying-answers
- https://sparxmaths.com/
- https://www.structural-learning.com/post/mathswatch
- https://link.springer.com/article/10.1007/s10639-026-13920-6
