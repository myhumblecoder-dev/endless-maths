# Epics and stories

Remaining work to make Endless Maths serve an 11- and 13-year-old. Grounded in
[`research.md`](research.md); architecture in [`architecture.md`](architecture.md).

**Where things stand:** 39 of 55 skills built, 110 tests passing, deployed.
16 skills remain — the entire fractions strand, the three expression skills, and
three needing multi-part answers. `n-count-20` is deliberately excluded: it
needs a visual counting interface and is irrelevant to this audience.

Every story is test-first — red, green, refactor. "Done" means `pnpm test`,
`lint`, `typecheck` and `build` all pass.

---

## Epic A — Interleaved practice

**Why now:** a focused session is currently 100% one skill. That is blocked
practice, and both Sparx (11–16, Cambridge trial) and the retrieval literature
put interleaving ahead of it. `dueFacts()` and `findGaps()` are already built
and tested, and nothing calls them. This is the cheapest epic and it improves
every one of the 39 existing skills.

**A1 — Mix review into every session**
Build a session as ~50% the chosen skill, ~33% review drawn from previously
mastered skills, ~17% stretch from the next unlocked skill.
*Done when:* a session of 20 contains problems from more than one skill; the
ratio holds within tolerance across seeds; the chosen skill is always the
largest share; existing no-repeat and max-run rules still hold.

**A2 — Schedule facts that are due**
Review slots prefer facts `dueFacts()` reports over random draws, weakest box
first.
*Done when:* a fact answered wrong reappears within the next two sessions; a
mastered fact does not reappear immediately; sessions stay reproducible by seed.

**A3 — Surface the real gap after repeated failure**
When a skill is failed repeatedly, use `findGaps()` to identify the deepest
unmastered prerequisite and offer it.
*Done when:* failing `p-solve-two-step` with weak `r-negative-add-sub` offers
the negatives skill; a learner with no gaps is never diverted.

**A4 — Show what a session will contain**
Before starting, show the mix so practice does not feel random.
*Done when:* the topic map previews the skills a session will draw on.

---

## Epic B — Fractions

**Why now:** the largest content gap, and core curriculum for an 11-year-old.
Nine skills. Needs a new answer type, an input mode, and rendering — the one
real investment identified in the tier analysis.

**B1 — Fraction answer type and equivalence**
Implement `check()` for `fraction` and `mixed`, returning
`equivalent-unsimplified` where the value is right but not in lowest terms.
*Done when:* `6/8` for `3/4` returns `equivalent-unsimplified`, never
`incorrect`; `0.75` is handled per the decision in B2; improper and mixed forms
compare correctly; the default throw still guards unknown kinds.

**B2 — Decide and encode the unsimplified policy**
Khan Academy is inconsistent here and learners get marked wrong for correct
answers. Decide once: does `equivalent-unsimplified` score as correct, prompt a
retry, or count partial?
*Done when:* the policy is recorded in `design.md` and applied in one place.

**B3 — Fraction input**
A two-box numerator/denominator entry with the existing keypad driving whichever
box has focus. MathLive is deliberately *not* used here — two boxes are faster to
tap and unambiguous.
*Done when:* both boxes are reachable by touch and by keyboard (Tab and `/`);
`canSubmit` is false until both are filled; a component test covers entry and
submission.

**B4 — Fraction rendering**
Stacked rendering with a horizontal rule, in prompts and in feedback.
*Done when:* fractions render stacked at every size used; mixed numbers render
correctly; nothing overflows on a narrow phone.

**B5 — Recognising and comparing fractions** (`f-identify`, `f-equivalent`, `f-compare`)

**B6 — Adding and subtracting, same denominator** (`f-add-like`, `f-sub-like`)

**B7 — Adding with different denominators** (`f-add-unlike`)
Generate backwards from a tidy result; denominators with a small LCM.

**B8 — Multiplying and dividing** (`f-multiply`, `f-divide`)

**B9 — Fractions, decimals and percentages** (`f-convert-fdp`)

*B5–B9 done when:* each generator builds backwards from the answer; property
tests assert results are proper and in range; the typed-path test passes for the
new answer kinds; the soak suite picks them up automatically.

---

## Epic C — Expression skills

**Why now:** collecting like terms and expanding brackets are Year 8–9 material
and squarely where a 13-year-old lives. MathLive (MIT) supplies the input and
MathJSON supplies canonical comparison, so the cost is far lower than the
original tier analysis assumed.

**C1 — Integrate MathLive**
Client-only dynamic import (it is a web component, so it must not run during
SSR). Verify bundle impact before committing to it.
*Done when:* a math field renders and accepts input; `pnpm build` succeeds; the
bundle delta is measured and recorded; SSR does not break; the virtual keyboard
is restricted to what these skills need.

**C2 — Expression answers and canonical comparison**
Add the `expression` branch to `check()` using MathJSON, so `3 + 5x` matches
`5x + 3`.
*Done when:* equivalent orderings compare equal; genuinely different expressions
do not; unparseable input is `incorrect`, never a crash.

**C3 — Collecting like terms** (`p-like-terms`)

**C4 — Expanding brackets** (`p-distribute`)

**C5 — Inequalities** (`p-inequalities`)
Includes the sign flip on multiplying by a negative — the classic misconception,
worth generating deliberately.

---

## Epic D — Multi-part answers

**Why now:** three skills blocked on one small capability, and all three are
live curriculum for an 11-year-old.

**D1 — Multi-part answer type and input**
Support answers with more than one field (quotient and remainder, `a : b`).
*Done when:* `check()` grades all parts; partial answers cannot be submitted;
component test covers moving between fields.

**D2 — Division with remainders** (`m-div-remainder`)

**D3 — Factors and multiples** (`r-factors-multiples`)
Set answers — order must not matter, duplicates must not count.

**D4 — Simplifying ratios** (`r-ratio-simplify`)

---

## Epic E — Fit and finish for older learners

**E1 — Keyboard-first practice**
These two will be on laptops. Every action reachable without a mouse.
*Done when:* a whole session can be completed from the keyboard alone, including
choosing a topic and starting again.

**E2 — Progress worth looking at**
Replace "done" ticks with something showing accuracy and speed trends per skill.
*Done when:* the topic map shows per-skill accuracy; nothing leaves the device.

**E3 — Session length**
20 is a guess. Sparx targets ~60 minutes a week; make the length adjustable.
*Done when:* length is configurable and persists.

---

## Sequence

**A → B → D → C → E.**

A is a day's work and improves all 39 existing skills. B is the biggest gap and
the largest build. D is cheap and finishes three skills. C depends on a new
dependency and is worth doing once the rest is stable. E is polish, best done
after they have actually used it.

**Do A first, then put it in front of them before starting B.** Their reaction
should shape everything after.
