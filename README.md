# GymNotes

A mobile-first, offline-first web app for planning, recording, and reviewing gym
workouts — built for use on an iPhone during training sessions.

**Core principle:** recording a set must be fast, reliable, and work offline.
**Brand essence:** quiet strength, measurable progress, no distractions.

Live: https://gym-notes-khaki.vercel.app

## Tech stack

- **Next.js 16** (App Router) · **React 19** · ES modules
- **PostgreSQL** via the **Neon** serverless driver
- **Clerk** authentication
- **Nodemailer** (Resend SMTP in production)
- **Jest 30** (ESM) for tests
- Deployed serverless (Vercel); database migrations run automatically on deploy

## Getting started

**Prerequisites:** Node.js 18+ and accounts/credentials for Neon (Postgres) and
Clerk (auth). Docker is optional but used to validate SQL locally.

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file from the template
cp .env.example .env.local
#    then fill in your own values (see "Environment variables" below)

# 3. Apply the database schema
npm run migrate

# 4. Run the app
npm run dev          # http://localhost:3000
```

### Environment variables

Copy `.env.example` and provide your own values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string (use the **pooled** string) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (`pk_...`) |
| `CLERK_SECRET_KEY` | Clerk secret key (`sk_...`) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Verifies Clerk user-sync webhooks (`whsec_...`) |
| `EMAIL_FROM` | Sender address for outgoing email |
| `RESEND_API_KEY` *or* `SMTP_HOST`/`SMTP_PORT` | Email transport (optional in dev) |

> **Never commit secrets.** `.env` and `.env*.local` are git-ignored — keep it that
> way. Share credentials with teammates through a password manager, never via git or
> chat.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (runs migrations afterwards via `postbuild`) |
| `npm run migrate` | Apply idempotent schema migrations to `DATABASE_URL` |
| `npm test` | Run the Jest test suite |
| `npm run test:watch` | Run tests in watch mode |

## Project structure

```
app/
  api/              # Route handlers (REST-ish, follow the API convention)
  lib/              # db (Neon), auth (getDbUser), email, metrics
  dashboard/ exercises/ templates/ train/ history/   # pages
  globals.css       # design tokens + styles
scripts/migrate.js  # idempotent migration runner (runs on deploy)
__tests__/          # Jest ESM tests (+ shared setup/mocks)
.kiro/specs/workout-tracker/   # requirements, design, tasks (source of truth)
AGENTS.md           # conventions for AI agents + contributors
```

## How we work

### Source of truth
The detailed project context lives in `.kiro/specs/workout-tracker/`
(`requirements.md`, `design.md`, `tasks.md`) and the conventions live in
[`AGENTS.md`](./AGENTS.md). Read them before making non-trivial changes, and keep
them updated as the shared decision log when you land a change.

### Working with AI agents
This project is developed with more than one AI coding agent (Kiro and Codex). Both
read repo files as their shared context: Codex reads `AGENTS.md`; Kiro reads
`.kiro/steering/project.md` (which points at `AGENTS.md`). Keep those in sync — they
describe the same conventions for different audiences.

### Branching & pull requests
With more than one contributor, prefer short-lived branches and PRs over pushing
straight to `main`:

```bash
git checkout -b feature/short-description
# ... make changes, commit ...
git push -u origin feature/short-description
# open a PR for review
```

- Keep commits focused with clear messages — they are the durable project history.
- Run `npm run build` and `npm test` before opening a PR; fix anything red.
- Add tests for new features and bug fixes; cover auth, validation, and cross-user
  access for new API routes (see `AGENTS.md` for the conventions).

## Status & roadmap

Built and deployed: foundation (auth, DB, email, tests, deploy), exercise library,
workout templates, live training with set logging, and training history.

Planned next: **offline-first operation + installable PWA** (the headline remaining
feature), then progress analytics, then production hardening. See
`.kiro/specs/workout-tracker/tasks.md` for the full milestone plan.
