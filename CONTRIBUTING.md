# Contributing

## Branching

GitFlow, with two long-lived branches:

| Branch | Role | Vercel |
| --- | --- | --- |
| `develop` | default; everything merges here first | preview deployment |
| `main` | releases only | **production** — the URL people actually use |

Feature branches come off `develop` and go back into `develop` via a pull
request. `main` only ever receives a merge from `develop`, and that merge *is*
the release.

```bash
git switch develop && git pull
git switch -c feat/42-short-description
# … work, test-first …
git push -u origin feat/42-short-description
gh pr create --base develop --title "…" --body "Closes #42"
```

Branch names: `feat/`, `fix/`, `docs/`, `chore/`, `spike/`, followed by the
issue number where there is one.

## Why the split

`main` auto-deploys to production, and the people using it are children in the
middle of a practice session. Before this existed, twenty commits went straight
to production — including the one where correct answers were being marked wrong.
Nothing had been seen on a real URL before it was live.

Every pull request now gets its own Vercel preview deployment. **Open the
preview and use it** before merging. Every UI bug in this project so far was
found by using the app, not by the test suite — a preview URL is the gate that
would have caught them.

## Releasing

```bash
git switch main && git pull
git merge --no-ff develop
git push
```

That deploys to production. Merge deliberately, not by habit: prefer releasing
when something is worth having live, rather than on every merge to `develop`.

## Before opening a pull request

All four must pass. CI runs them on every push and pull request, but running
them locally first is faster than waiting:

```bash
pnpm test        # property, typed-path, soak and component suites
pnpm lint
pnpm typecheck   # runs next typegen first, so it works on a clean checkout
pnpm build       # catches App Router mistakes the others miss
```

`pnpm test` is not optional when touching `src/lib/problems/`. Those property
tests are the only thing standing between a refactor and an app that marks a
child wrong for being right.

## Working style

**Test-first — red, green, refactor.** Write the failing test, run it and watch
it fail, then write the code. This is not ceremony: in this codebase it has
repeatedly forced design corrections that would otherwise have shipped. Two
examples worth knowing about, both from `docs/design.md`:

- gating strictly on prerequisites left a brand-new learner with *nothing* to
  practise, because every arithmetic skill descends from an unbuilt skill
- stepping over that unbuilt skill naively then offered prime numbers to a
  five-year-old

Neither would have been noticed by writing the implementation first.

Code without a test is removed rather than retro-fitted with one.

## Where to look

| | |
| --- | --- |
| `docs/architecture.md` | how the code is arranged, and the invariants |
| `docs/design.md` | what we are building and why |
| `docs/research.md` | prior art, and the decisions it reversed |
| `docs/epics-and-stories.md` | the remaining work |
| `AGENTS.md` | the short version, for AI agents |

Issues are labelled by epic (`epic-a` … `epic-e`). Reference them from the pull
request body with `Closes #n`.
