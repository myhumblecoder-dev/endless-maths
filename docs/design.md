# Endless Maths — design

Status: draft, pre-implementation. Supersedes the intent recorded in
`POC_EndlessMath.API`. Nothing here is built yet.

## What this is

An endless maths practice app for **primary-school children (roughly ages 5–13)**,
spanning counting through pre-algebra. A child practises; the system works out
what they don't know yet and keeps feeding them exactly that.

## The load-bearing decision

**The maths engine is deterministic. The model never generates arithmetic.**

The POC asked an LLM to *"generate 20 beginner addition problems"*. That is the
one job a language model is worst at and a pure function is best at:

| | LLM generation | Pure function |
| --- | --- | --- |
| Cost | ~$0.0001/problem | $0 |
| Latency | 1–2s per batch | 0ms |
| Correctness | probabilistic — can emit `7 × 8 = 54` | provable |
| Offline | no | yes |

A maths app that marks a child wrong for being right is worse than no app, so
correctness is not negotiable. Because generation is a seeded pure function, it
runs **in the browser**: no server, no key, no latency, works on school wifi.

The model earns its place on the *language* around the maths — never the maths.
See [AI layer](#ai-layer).

## Four things that shape everything else

### 1. Facts are not interchangeable

`2 × 5` and `7 × 8` are not the same task. A uniform random draw over
"multiplication" spends most of a child's session on facts they already own.
Personalization here is not a difficulty *dial* — it is knowing which of ~300
specific facts this child hasn't got yet. So mastery is tracked **per fact**,
and facts are scheduled by spaced repetition.

### 2. Speed is the signal — but only for facts

For times tables the goal is *recall*, not *computation*. A child who reaches
`7 × 8 = 56` after nine seconds of counting up in eights has not learned it, but
a correctness-only system scores that identically to instant recall. Response
time separates them and is free to collect.

**This is wrong for procedures.** A child *should* spend 40 seconds on a
two-step equation. Applying a fluency threshold there would punish exactly the
careful working we want. Hence every skill declares its `kind` — see
[Facts vs procedures](#facts-vs-procedures).

Collect timing silently. Never show a countdown: visible timers produce maths
anxiety in this age group.

### 3. Client-side-only is a regulatory moat, not a shortcut

The users are children, so server-side data drags in COPPA and GDPR-K: parental
consent, retention policy, deletion requests, age gating. Keeping mastery state
in `localStorage`, with nothing leaving the device, avoids all of it — and
composes perfectly with a deterministic engine that needs no server anyway.

The first feature that breaks this is a parent dashboard with cross-device sync.
That is the moment the compliance work starts. Defer it deliberately.

**That moment has now been chosen deliberately — see "What may leave the
device" below.**

### 4. Endless supply, bounded sessions

The product is called Endless Maths, but a seven-year-old needs a finish line.
Infinite scroll is demotivating — there is no moment of "I did it". The
*supply* is endless; a *session* is ~20 problems or five minutes, with a visible
progress bar and a clear end.

## Can we really go from counting to pre-algebra?

Yes. Every skill in the range is deterministically generatable using one
technique, and three things change along the way.

### The technique: generate backwards from the answer

**Never generate a problem and then solve it. Pick the answer, then construct
the problem around it.** This guarantees clean answers, needs no solver, and
never produces `x = 3.714285…`.

```ts
// Two-step equation: ax + b = c
const x = pick(rng, 1, 12)        // the solution, chosen FIRST
const a = pick(rng, 2, 9)
const b = pick(rng, -10, 20)
const c = a * x + b               // construct the problem to fit
// present "3x + 4 = 19", answer x
```

The same inversion handles division without remainders (pick quotient and
divisor, multiply), fraction addition with a tidy result (pick denominators with
a small LCM), and percentages that land on integers. Roughly 50 generators of
10–30 lines each, every one property-testable: *the answer is always an integer*,
*operands stay in range*, *the result is always proper*.

### What breaks #1: the answer stops being a number

`answer: number` survives until fractions, then dies. Is `6/8` a correct answer
for `3/4`? Is `0.75`? Is `3 + 5x` the same answer as `5x + 3`? All yes
mathematically, and the checker must know it.

So an answer is a tagged union with a per-kind comparison, and grading has
**three** outcomes, not two — `6/8` for `3/4` is not wrong, it is unfinished:

```ts
type Verdict = 'correct' | 'equivalent-unsimplified' | 'incorrect'
```

This is the single most important thing to design in now. Retrofitting it after
the integer skills ship means touching every generator, every check, and the
whole scoring history.

### What breaks #2: the keypad

A numeric keypad works for `56`. It does not work for `3/4`, `x = 5`, or
`2x + 3`. Input escalates with the strand: numeric → fraction (two fields) →
a light expression input.

Multiple choice is the tempting escape and it is a bad one: it lets a child
guess, and guessing destroys the response-time signal that everything else
depends on.

### What breaks #3: "mastering a fact" stops meaning anything

`7 × 8` is a **fact** — atomic, memorizable, one of a finite set. "Solving
two-step equations" is a **procedure** — infinitely many instances, nothing to
memorize. They need different scheduling. See below.

### The one genuine gap

Geometry (area, perimeter, angles) is generatable but needs diagram rendering,
which is a different kind of work from everything else here. It is deliberately
out of scope for now. Also out: multi-step real-world modelling, proof, and
open-ended investigation — none of which this format serves well anyway.

## Facts vs procedures

Every skill declares which it is, and that drives scheduling:

| | Fact | Procedure |
| --- | --- | --- |
| Example | `7 × 8` | solve `3x + 4 = 19` |
| Instances | finite (~300 total) | unbounded |
| Mastery means | correct **and** fast (<3s) | correct rate over recent attempts |
| Scheduling | spaced repetition per fact | sampled difficulty within skill |
| Speed matters | yes — it *is* the goal | no — penalizing it is harmful |

## The curriculum graph

Skills form a **DAG, not a ladder**. With ~50 skills, prerequisites are the
point: a child failing two-step equations may actually have a negative-numbers
gap, and walking the prerequisite graph backwards finds the true gap.

That backward walk is the most valuable personalization in the product, and it
is pure graph traversal — no model involved.

Six strands, ~50 skills: number sense → addition/subtraction →
multiplication/division → fractions/decimals/percentages → ratio, negatives and
order of operations → pre-algebra. Defined in `src/lib/curriculum/skills.ts`.

## Simplifying is part of the skill

`3/4` is the answer. `6/8` is the right value in the wrong form, and putting it
in lowest terms is itself a thing worth practising — so it is neither accepted
silently nor marked wrong.

`equivalent-unsimplified` is its own outcome with its own response: tell the
learner the value is right and invite them to simplify, then let them answer
again. Only the simplified form completes the problem.

Two things this must never become:

- **Marking it wrong.** It is not wrong, and telling a child it is teaches them
  to distrust their own correct reasoning.
- **Silently accepting it.** That is the [Khan Academy
  inconsistency](research.md) — students there meet both behaviours inside one
  lesson and cannot tell which applies.

The rule holds everywhere it could apply: fractions, and simplified ratios
(`2 : 3`, not `4 : 6`). It lives in one place so it cannot drift.

## What may leave the device

Sending a journey to a model is the moment client-side-only stops being true.
It was decided once, in the open, rather than drifting into it.

**The full journey may leave. Names may not.**

- Every attempt, **including the wrong answers** — `1/2 + 1/3 = 2/5` is a
  diagnosis, "got it wrong" is not, and an analysis without the mistakes is
  worth very little.
- Under a **profile id, never a name.** "Eddie" identifies a child; `p_3f9a`
  does not. Names are stored locally so a child recognises their own profile,
  and are stripped from anything that crosses the boundary.
- **Nothing crosses without an adult doing something explicit.** Not on a
  timer, not on a session ending.

The name rule is enforced in one place and tested, because a rule that depends
on everyone remembering it is not a rule.

## Deployment shape

One Next.js package, deployed to Vercel as a single unit. **Not a monorepo** —
a workspace would add tooling overhead for no benefit with one deployable and
one language. (The root `pnpm-workspace.yaml` defines no workspace; it carries
only build-permission flags that create-next-app writes.)

Next.js is doing full-stack work here in capability only. Almost nothing runs on
the server:

| Concern | Runs | Why |
| --- | --- | --- |
| Generation, grading, scheduling | browser | pure functions; zero cost, zero latency, works offline |
| Mastery state | browser, `localStorage` | children's data never leaves the device |
| Word-problem templates | build time | pre-generated and reviewed once |
| Hints | server, `/api/hint` | the only place an API key can exist |
| Parent summaries | server, batched | never in the child's path |

A child can answer a thousand problems and reach the server zero times. This is
the POC's architecture inverted: the .NET service was a network hop on the
critical path, and removing it is the point.

Revisit the single-package decision if a mobile app needs to share the engine,
or the engine gets published separately. Extraction is cheap by construction —
`src/lib/problems` and `src/lib/curriculum` import no React, no Next.js, and no
DOM, so moving them to `packages/engine` is a directory move plus a
`package.json`, not a refactor.

## Data model

Types live in `src/lib/curriculum/types.ts`. The shape:

- `Skill` — id, strand, kind (fact|procedure), prerequisites, answer kind
- `Problem` — the generated item: prompt parts, `Answer`, originating skill,
  and the `factKey` when it is a fact
- `Answer` — tagged union (integer, decimal, fraction, mixed, expression, set)
- `FactState` / `SkillState` — per-child mastery, `localStorage` only
- `Attempt` — what was given, the verdict, elapsed ms

Note the POC fused problem and answer into one display string
(`ListOfEquations: ["1 + 1 = 2"]`), which makes grading impossible. Answer is
always a separate, typed field.

## AI layer

Nothing here is in the child's hot loop. A child can do a thousand problems and
trigger zero model calls.

| Use | When | How |
| --- | --- | --- |
| Word problems | runtime, zero cost | pre-generate ~500 templates offline via the Batch API, human-review once, fill numeric slots deterministically. Themed: football, animals, space, baking. |
| Hints | after a second wrong attempt | live call — low volume, latency-tolerant, highest value |
| Parent/teacher summary | weekly, batched | never in the child's path |

**Never put unreviewed model output in front of a child.** Pre-generated
templates mean reviewing 500 items once rather than trusting a live generation
seen by a seven-year-old with no adult present. This is a safety argument that
happens to also be the cheap one.

Misconceptions (`1/2 + 1/3 = 2/5` — the classic "add across" error) are
hard-coded per skill from the maths-education literature, not inferred. The top
five per skill are well documented and beat a model's guess.

## Implementation tiers

The skill graph maps the *domain*. It does not map the *work* — those are
different shapes, and building in curriculum order gets the order wrong.

What actually determines cost is **which input widget and answer type a skill
demands**, not where it sits in the curriculum:

| Tier | Needs | Skills | Cost each |
| --- | --- | --- | --- |
| 1 | numeric keypad, integer answer, one line of text | 35 | ~15 lines |
| 1.5 | + a decimal point on the keypad | 4 | near-zero |
| 2 | fraction type, equivalence, stacked rendering — or multi-part answers | 12 | medium, one-time |
| 3 | expression canonicalization + expression input, or a new UI paradigm | 4 | large |

**37 of 55 skills need nothing beyond a numeric keypad**, and they span ages
5–13 — from number bonds to unknowns on both sides of an equation, without ever
rendering a fraction or parsing an expression.

### Consequence: build the spine, not the ladder

Fractions are the expensive strand and they sit in the *middle* of the
curriculum. Building bottom-up means hitting the hardest work at 40% done with
nothing shippable. Build the **spine** instead — arithmetic → negatives → order
of operations → equations — which is one coherent path, entirely Tier 1, and
delivers the full counting-to-pre-algebra claim. Fractions then become a
self-contained investment rather than a blocker.

Two-step equations cost the same to build as two-digit addition: both are a few
lines, an integer answer, and a keypad. Pre-algebra is not the expensive end of
this curriculum.

### Return on the three unlocks

| Investment | Unlocks | Verdict |
| --- | --- | --- |
| Decimal point on the keypad | 4 skills | free — do it immediately |
| Fraction type + equivalence + stacked rendering | 9 skills | best return; the one investment worth making |
| Multi-part answers (remainders, ratios, factor sets) | 3 skills | cheap; do it when a skill needs it |
| Expression engine + expression input | 3 skills | **worst return in the project** |

~~The last row is the trap.~~ **Superseded — see `research.md`.** That
reasoning assumed we would write the expression input and the canonicaliser
ourselves. MathLive supplies both (MIT, `<math-field>`, MathJSON output), so the
cost collapses. And for a 13-year-old, collecting like terms and expanding
brackets are not a rounding error — they are the curriculum. Tier 3 is now worth
building.

## Build order

1. ~~**The Tier 1 spine.**~~ Done — 37 generators in `src/lib/problems/`.
2. ~~**The loop.**~~ Done — one problem at a time, keypad, instant feedback,
   bounded session, `localStorage`.
3. ~~**Placement and the skill map.**~~ Done — see above.
4. **Play it with an actual child.** Whether the loop is fun is not something
   that can be reasoned out.

Only then: fractions (Tier 2), then word problems, then hints. If step 4 is not
fun, no amount of AI rescues it.

Known gaps: the fact scheduler exists (`dueFacts`) but nothing consumes it yet —
a focused session draws from its skill without consulting spaced repetition.
`findGaps()` is likewise built and unused.

## Placement

The skill graph is a wall without it: every learner starts at number bonds and
must grind three infant skills before anything else unlocks. A ten-year-old
would quit before reaching times tables.

**A one-time quiz across every strand, then hard locks.** Per strand it probes
easiest → hardest → binary search:

- the easiest-first short-circuit means a struggling child leaves a strand after
  one question rather than sitting through a run of failures
- the hardest-second short-circuit means a confident learner clears a whole
  strand in two

Measured: **6 questions** for a beginner, **9** for a ten-year-old (placing out
of 24 skills, straight to long division), **12** for an adult. An
"I don't know this one" button means nobody has to guess wildly, and the quiz
deliberately shows no right/wrong — it is a placement, not a test.

`Progress.placed` records it, kept apart from `Progress.skills` because being
placed out of something is not the same as having practised it, and only
practice yields fact-level fluency data. `placementDone` is separate again: a
genuine beginner places out of nothing and must not be handed the quiz forever.

**Locks are hard.** The map shows every skill, but locked ones are not
selectable — seeing what is coming motivates, faceplanting into it does not.
Placement is what moves a learner across the map, not tapping through locks.

## Open questions

See `research.md` — prior art has since settled two of these and reversed two
decisions recorded above (the expression engine's cost, and blocked practice).

- ~~Does unsimplified (`6/8` for `3/4`) count as correct?~~ **Settled — see
  "Simplifying is part of the skill" below.**
- Placement is a single snapshot. A child who has a bad day is placed low and
  has no way back up except grinding. Does it need re-sitting, or should
  sustained accuracy auto-promote?
- Sound and animation — motivating for this age group, but a hard accessibility
  and classroom-use constraint.
- One child per device, or a lightweight local profile switcher for siblings and
  classroom tablets?
