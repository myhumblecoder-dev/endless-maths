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

## Branching

GitFlow. `develop` is the default branch and gets every change first; `main` is
releases only and auto-deploys to **production**, which children are using.

Branch off `develop`, open a pull request back into `develop`, never commit
straight to either long-lived branch. Full flow in `CONTRIBUTING.md`.

```bash
git switch develop && git pull
git switch -c feat/42-short-description
gh pr create --base develop --body "Closes #42"
```

## Before you say you're done

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

All four must pass; CI runs the same four. `pnpm build` catches App Router mistakes the others miss.

`pnpm test` is not optional when touching `src/lib/problems/`. The property
tests are the only thing standing between a refactor and an app that marks a
child wrong for being right.

## Notes for agents

- Work test-first: red, green, refactor. Code arriving without a test is
  removed in the refactor step, not retro-fitted with one.
- Don't add a dependency without saying why in the PR/commit body. Measure the
  bundle cost before adopting anything large — see the MathLive spike in
  `docs/research.md` for why.
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
