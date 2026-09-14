# Endless Maths

An endless, personalized maths practice generator — pick an operation, get a
never-ending stream of problems tuned to you. Built for learners who need volume
and for the people teaching them.

**Production:** https://endless-maths.vercel.app
**Repo:** https://github.com/myhumblecoder-dev/endless-maths

## Requirements

- Node `24.18.1` (see `.nvmrc` — `nvm use`)
- pnpm `12.4.1` (`corepack enable` — version is pinned in `package.json`)
- Vercel CLI for env sync (`pnpm dlx vercel`)
- External services: a generative-AI provider (not yet wired up — see [Notes](#notes))

## Getting started

```bash
pnpm install
pnpm dlx vercel env pull .env.local   # or: cp .env.example .env.local
pnpm dev
```

## Environment variables

| Variable | Required | Scope | Where to get it |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | client | Vercel project URL (`http://localhost:3000` locally) |
| `AI_API_KEY` | not yet | server | Provider dashboard — unused until generation is wired up |

Anything prefixed `NEXT_PUBLIC_` ships to the browser. Everything else stays server-only.

## Approach

This replaces `POC_EndlessMath.API`, a .NET 6 service that proved the core idea:
that a generative model can personalize maths practice rather than serving the
same static problem bank to everyone. The POC settled the question and is not
the production path — a single Next.js app on Vercel removes a deployment target
and a network hop, and keeps problem generation next to the UI that consumes it.

Rendering leans static. The shell — landing page, operation picker, anything
describing the product — is statically rendered at build time. Problem
generation is the only genuinely dynamic surface, and it lives behind route
handlers in `src/app/api/` so the model key never reaches the browser and so
responses can be cached per difficulty bucket rather than per request. Client
components are the exception, not the default: reach for `"use client"` only
where a learner is actually typing or clicking.

The domain carries over from the POC. An operation type (addition, subtraction,
multiplication, division) is the primary axis; a request carries that operation
plus difficulty signals, and a response carries a batch of problems. Batching
matters — generating twenty problems per call and streaming them to the learner
is what makes the practice feel endless without a model round trip between
every question.

Deliberately not doing yet: no database, no auth, no accounts. Progress and
difficulty live in the session until there's a reason for them to outlive it.
Adding Postgres and Clerk before knowing what's worth persisting would be
guessing.

### Structure

```
src/app/          routes, layouts, route handlers
src/components/   shared UI
src/lib/          data access, clients, pure logic
src/types/        shared types
```

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Local dev server |
| `pnpm build` | Production build (run before pushing) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |

## Deployment

Hosted on Vercel. `main` → production; every PR gets a preview deployment.
Env vars are managed in the Vercel dashboard, not in the repo — add there first,
then `vercel env pull`.

## Notes

- **Generation is not wired up.** The scaffold is in place; no model client,
  no `src/lib/` generator, no API route yet. `AI_API_KEY` is a placeholder in
  `.env.example` and the provider choice is still open.
- **Personalization is undefined.** The POC hardcoded "20 beginner problems" per
  operation. What difficulty actually means, and what signals adjust it, is the
  first real design decision.
- **Answer checking is unsolved.** The POC returned equations with answers
  included (`1 + 1 = 2`). Problems and answers need to be separate fields before
  anything can be graded.
- Reference POC: `../POC_EndlessMath.API` — read `Services/GenAiService.cs` and
  `Enums/OperationType.cs` for intent.

## License

UNLICENSED
