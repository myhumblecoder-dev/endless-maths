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

## Build order

1. **Engine + one skill, no AI.** `×2/×5/×10` only, plus the fact scheduler.
2. **The loop.** One big problem, on-screen keypad, instant feedback, 20-problem
   session, progress bar, `localStorage`.
3. **Play it with an actual child.** Whether the loop is fun is not something
   that can be reasoned out.

Only then: the full skill graph, then word problems, then hints. If step 2 is
not fun, no amount of AI rescues it.

## Open questions

- Does unsimplified (`6/8` for `3/4`) count as correct, prompt a retry, or score
  partial? Affects `Verdict` handling throughout.
- How does a child pick a starting point without a placement test that feels
  like an exam?
- Sound and animation — motivating for this age group, but a hard accessibility
  and classroom-use constraint.
- One child per device, or a lightweight local profile switcher for siblings and
  classroom tablets?
