# AGENTS.md

Working notes for AI coding agents (and humans) in this repo.

## What this is

`endless-maths` is the web app for **endlessmath.org** — an endless, personalized
maths practice generator. A learner picks an operation (addition, subtraction,
multiplication, division) and gets a never-ending stream of problems, with
generative AI shaping difficulty and phrasing to the individual.

It supersedes the .NET 6 proof of concept in `../POC_EndlessMath.API`, which
is not the production path.

**Read `docs/design.md` before making design decisions.** The short version: the
maths engine is deterministic and runs client-side; the model is a language
layer (word problems, hints) and never generates arithmetic. Mastery state stays
in `localStorage` because the users are children and server-side data means
COPPA.

## Stack

- Next.js (App Router) + TypeScript, `src/` layout, `@/*` import alias
- Tailwind CSS v4
- pnpm (pinned via `packageManager` in `package.json`; Node pinned in `.nvmrc`)
- Deployed on Vercel

## Conventions

- `src/app/` — routes, layouts, route handlers. Server Components by default;
  add `"use client"` only where interactivity actually requires it.
- `src/components/` — shared UI.
- `src/lib/` — data access, external clients, pure logic. Problem generation
  and any model calls belong here, never inline in a component.
- `src/types/` — shared types.
- Keep secrets server-only. Anything named `NEXT_PUBLIC_*` ships to the browser.

## Before you say you're done

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

All four must pass. `pnpm build` catches App Router mistakes the others miss.

`pnpm test` is not optional when touching `src/lib/problems/`. The property
tests are the only thing standing between a refactor and an app that marks a
child wrong for being right.

## Notes for agents

- Don't add a dependency without saying why in the PR/commit body.
- Don't commit `.env.local`. Add new vars to `.env.example` (name + comment,
  never a real value) and to the README's env table.
- The POC's domain model is worth reading for intent, not for structure. Note
  it fused problem and answer into one string (`"1 + 1 = 2"`), which makes
  grading impossible — `Problem.answer` is always a separate typed field.
- The skill graph (`src/lib/curriculum/skills.ts`) is a DAG. If you add a skill,
  re-check it for cycles and dangling prerequisites.
- Generators build problems **backwards from the answer** — pick the solution,
  then construct the problem. Never generate a problem and then solve it.
- Decimal skills compute in scaled integers and convert once via `dec()`.
  Float arithmetic gives `0.1 + 0.2 === 0.30000000000000004`.
- `check()` throws on answer kinds it cannot grade rather than guessing. A
  wrong `false` marks a child incorrect for a right answer.
