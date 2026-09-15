# Architecture

How the code is arranged and why. For *what* we are building and the decisions
behind it, see [`design.md`](design.md); for prior art, [`research.md`](research.md).

## Shape

One Next.js package deployed to Vercel. Next.js is doing full-stack work in
capability only — almost nothing runs on the server, by design:

| Concern | Runs | Why |
| --- | --- | --- |
| Problem generation | browser | seeded pure functions — free, instant, works offline |
| Grading | browser | `check()` is pure |
| Placement, scheduling, mastery | browser | arithmetic over local state |
| Persistence | browser, `localStorage` | children's data never leaves the device (COPPA) |
| Hints *(not built)* | server route handler | the only place an API key could exist |

A learner can answer a thousand problems and reach the server zero times.

## Layers

Dependencies point downward only. Nothing in `lib/` imports from `components/`.

```
  components/            React. Rendering and input only — no maths, no rules.
      │                  App · PlacementQuiz · SkillMap · Practice · Keypad · SafeScreen
      ▼
  lib/placement/         Which level is this learner at?
  lib/session/           What comes next, and was that right?
  lib/mastery/           What do they know, and what persists?
      │
      ▼
  lib/problems/          Generate a problem. Grade an answer. Format it.
      │
      ▼
  lib/curriculum/        Types and the 55-skill DAG. Data, no behaviour.
```

Everything below `components/` is pure, synchronous and framework-free: no
React, no Next.js, no DOM. That is what makes it exhaustively testable, and what
would make extracting an engine package a directory move rather than a refactor.

## Module map

### `lib/curriculum/`
- **`types.ts`** — `Skill`, `Problem`, `Answer`, `Verdict`, `FactState`,
  `SkillState`, `Attempt`, `SkillId`.
- **`skills.ts`** — the 55-skill DAG across six strands, plus `findGaps()`,
  which walks prerequisites backwards to locate the *real* gap behind a failure.

### `lib/problems/`
- **`rng.ts`** — seeded `mulberry32`, `pick`, `pickFrom`, `until`.
- **`build.ts`** — `int()`, `dec()`, `choice()`, `problem()`.
- **`numberSense · addSub · mulDiv · decimals · fractions · ratioNegatives ·
  preAlgebra`** — the 48 implemented generators, grouped by strand.
- **`index.ts`** — the `GENERATORS` registry and `generate()`.
- **`check.ts`** — grading. Throws on answer kinds it cannot grade rather than
  guessing, because a wrong `false` marks a correct answer wrong.
- **`fraction.ts`** — integer-only fraction arithmetic: `gcd`, `simplify`,
  `parseFraction`, `sameValue`. Nothing here converts to a decimal, because
  `1/3` has none and comparing by float would eventually mark a correct answer
  wrong.
- **`format.ts`** — `formatAnswer()`, `feedbackText()`. Presentation only.

### `lib/mastery/`
- **`mastery.ts`** — `Progress`, `record()`, and the mastery rules.
- **`storage.ts`** — `localStorage` behind an injected `KeyValueStore`, so it is
  testable without a DOM. Never throws.

### `lib/session/`
- **`scheduler.ts`** — `unlockedSkills()`, `nextSkill()`, `dueFacts()`.
- **`session.ts`** — a bounded run of problems; `answer()` grades and records,
  and the session mix interleaves review with the chosen skill.
- **`diagnose.ts`** — `isStruggling()`, `gapBehind()`. Finds the weak foundation
  under a skill someone keeps failing.
- **`keypad.ts`** — `press()`, `canSubmit()`, `isEntryKey()`. Pure input rules.

### `lib/placement/`
- **`placement.ts`** — the level-check state machine.

### `components/`
- **`App.tsx`** — the only stateful shell: loads progress, routes between
  placement, the topic map, and practice.
- **`SafeScreen.tsx`** — error boundary. Class component because React has no
  hook equivalent of `componentDidCatch`.

## Rules that hold everywhere

These are invariants, not style preferences. Each exists because breaking it
produced a real bug.

1. **Generate backwards from the answer.** Pick the solution, then construct the
   problem. No solver, and never `x = 3.714285…`.
2. **Decimals compute in scaled integers** and convert once via `dec()`.
   `0.1 + 0.2 === 0.30000000000000004`.
3. **Problem and answer are separate typed fields.** The POC fused them into
   `"1 + 1 = 2"`, which makes grading impossible.
4. **`check()` throws rather than guesses.** Marking a correct answer wrong is
   the worst thing this app can do.
5. **Session and mastery updates are pure.** `answer()` and `record()` return new
   objects; nothing mutates.
6. **Everything is seeded.** Same seed, same session — so a bug is reportable and
   a teacher can hand one set to a class.
7. **Components render; `lib/` decides.** Any rule that can be stated without a
   DOM belongs below the component layer.

## Testing strategy

Four kinds, because each catches what the others cannot. All must pass:
`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

| Kind | Where | Catches |
| --- | --- | --- |
| **Property** | `problems/*.test.ts` | maths errors — every answer an integer, division exact, no ambiguous rounding, equations balance |
| **Typed-path** | `problems/typed.test.ts` | answers a person can type but the keypad cannot produce, or grades wrong |
| **Soak** | `lib/soak.test.ts` | crashes at volume — 195k generations, 300 placements, 150 full sessions, corrupt storage |
| **Component** | `components/*.test.tsx` | UI wiring — every bug that reached a real user lived here |

The component tests exist because the property tests caught **every** maths bug
and **zero** UI bugs. A bare answer with no label, a session restarting on each
answer, and keystrokes swallowed during feedback all shipped past a green suite.

Component tests opt into jsdom per file with `// @vitest-environment jsdom`, so
the pure suites stay in plain node.

## Extension points

### Adding a skill
1. Add it to `SKILLS` in `curriculum/skills.ts` with its `requires`, `kind`
   (fact or procedure) and `answerKind`.
2. Write the generator in the strand's file, building backwards from the answer.
3. Register it in `problems/index.ts`.
4. The property and soak suites pick it up automatically — `IMPLEMENTED` drives
   them, so a new skill is exercised without touching a test.

### Adding an answer kind
1. Extend the `Answer` union and `AnswerKind` in `curriculum/types.ts`.
2. Add a branch to `check()` — including whether `equivalent-unsimplified`
   applies.
3. Add a branch to `formatAnswer()`.
4. Give `Keypad` an input mode for it.

Step 2 is where care is owed: the default branch throws deliberately, so a
missing branch fails loudly rather than marking a learner wrong.

## Known gaps

- **4 of 55 skills are unimplemented**: the three expression skills (#16-18),
  and `n-count-20`, which needs a visual counting interface and is irrelevant
  to an 11- and 13-year-old.
- **No server code exists yet.** The hints path is designed, not built.
- **Placement is a single snapshot.** "Change my level" is the only correction.
