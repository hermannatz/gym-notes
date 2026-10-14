# AGENTS.md — GymNotes

Guidance for AI coding agents (Codex, etc.) and human contributors working in
this repository. Keep this file and `.kiro/steering/project.md` in sync — they
share the same conventions; only the audience differs.

## What this project is

GymNotes is a mobile-first, offline-first web app for planning, recording, and
reviewing gym workouts (primarily iPhone/Safari, installable as a PWA). Core
principle: **recording a set must be fast, reliable, and work offline.**

## Source of truth

The detailed, authoritative project context lives in the spec, which is kept
current as milestones land. Read these before making changes:

- `.kiro/specs/workout-tracker/requirements.md` — requirements (EARS format)
- `.kiro/specs/workout-tracker/design.md` — architecture, decisions, the API
  surface for every milestone, data model, and the visual design system
- `.kiro/specs/workout-tracker/tasks.md` — milestone plan and what is done vs. next

If this file and the spec ever disagree, the spec wins — and please fix the drift.

## Tech stack

- **Next.js 16** (App Router), **React 19**, ES modules (`"type": "module"`)
- **PostgreSQL via Neon serverless driver** (`@neondatabase/serverless`), tagged-template `sql`
- **Clerk** auth (`@clerk/nextjs`) with middleware/proxy route protection
- **Nodemailer** (Resend SMTP in prod, local SMTP fallback)
- **Jest 30** in ESM mode (Node test environment)
- Deployed serverless (Vercel-style); migrations run on `postbuild`

## Conventions (follow these)

**API routes** — every authenticated handler follows this order:
1. `getDbUser()` → `Response.json({ error: 'Unauthorized' }, { status: 401 })` when null
2. Validate input → `400` on bad input
3. Wrap work in `try/catch`, `console.error` server-side, `500` on failure
4. Always respond with `Response.json(...)`

**Authorization / ownership**
- Ownership is enforced **in SQL** (`WHERE owner_user_id = ${user.id}`, or subquery
  guards for nested rows). Never trust a client-supplied user id.
- A resource the caller may not touch should match nothing and return **404, not 403**
  (don't leak the existence of other users' private data).

**Database & migrations**
- Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  `ON CONFLICT`), appended to `scripts/migrate.js`, and run automatically on `postbuild`.
- The Neon HTTP driver runs **one statement per tagged-template call**. Split
  multi-statement work into separate migration entries; use `sql.transaction([...])`
  for atomic multi-write operations (reorder, snapshot-on-start).
- Client-creatable entities use UUID primary keys (offline-ready); server-only data
  (`users`, `muscle_groups`) uses SERIAL.

**Testing**
- `npm test` (Jest ESM). Mocks live in `__tests__/setup.js`; import route handlers
  **dynamically** inside `beforeEach` after `resetMocks()`.
- Cover the convention (401/400/500) and **cross-user access denial** for every
  protected route.
- Mocks can't catch SQL errors — validate non-trivial SQL against real Postgres (a
  throwaway Docker `postgres:16` container) before committing. Clean up after.
- Don't add tests the task didn't ask for, but do test new features/bug fixes.

**Verification before done**
- Run `npx next build` and `npm test`; fix anything red before presenting work.

**Design system**
- Dark-first, one restrained electric-lime accent, matte surfaces, fine borders,
  tabular numerals for metrics. Tokens live in `app/globals.css` (`:root` +
  `prefers-color-scheme` light overrides). Reference tokens, don't hardcode colors.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local` (or `.env`) and fill in your own credentials
   (Neon `DATABASE_URL`, Clerk keys, `CLERK_WEBHOOK_SIGNING_SECRET`).
3. `npm run migrate` to apply schema; `npm run dev` to run locally.

## Security / do-not

- **Never commit secrets.** `.env`, `.env*.local` are git-ignored — keep it that way.
  Share credentials through a secure channel (a password manager), never via git or chat.
- Don't make outbound requests that transmit code/secrets to third parties.

## Workflow notes

- Keep the three spec files updated as the shared decision log when you land a change.
- Prefer clear commit messages — they are the durable cross-agent "memory."
- With more than one contributor, prefer short-lived branches + PRs over pushing
  straight to `main`.
