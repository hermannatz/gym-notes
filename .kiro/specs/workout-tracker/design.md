# Design — Offline-First Workout Tracker

## Overview

A mobile-first, offline-first PWA for recording gym workouts, built on Next.js 16 (App
Router) with a Neon Postgres backend, Clerk authentication, and Nodemailer email. The
browser (IndexedDB + service worker) is the durable source of truth during a workout; the
Next.js API routes are an idempotent sync target backed by Postgres.

This document covers the full architecture, but the **first implementation milestone
(Milestone 0) is the foundation only** — exactly the files in Prompt 1, with just the
`users` table. Domain tables, routes, and UI follow in later milestones.

### Guiding principles

- **Recording a set never blocks on the network.** Writes land in IndexedDB first; sync is a
  background reconciliation, never a prerequisite for data entry.
- **Server is the authority for identity and ownership.** The client never asserts whose data
  it is; the server derives the user from Clerk and the `users` table.
- **Idempotent, append-only migrations.** `CREATE TABLE IF NOT EXISTS` statements run on every
  deploy via `postbuild`; new tables are appended, never rewritten destructively.
- **One API convention.** Every authenticated handler: auth → validate → try/catch →
  `Response.json`.
- **Derive, don't duplicate.** Analytics are computed from recorded sets, not stored as the
  authoritative aggregate.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        iPhone Safari (PWA)                     │
│                                                                │
│  React UI (App Router pages)                                   │
│       │                                                        │
│       ▼                                                        │
│  Local store layer  ──writes──►  IndexedDB  (source of truth   │
│       │                           for unsynced changes)        │
│       │                                                        │
│       ▼                                                        │
│  Sync engine  ◄── triggers: app open / focus / online / manual │
│       │                                                        │
│  Service worker (asset + app-shell cache, PWA manifest)        │
└───────┼────────────────────────────────────────────────────────┘
        │  HTTPS (batched, idempotent sync requests)
        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js 16 (serverless, Vercel-style)        │
│                                                                │
│  middleware.ts  ── Clerk route protection                      │
│       │                                                        │
│       ▼                                                        │
│  app/api/*/route.js  ── convention: getDbUser → validate →     │
│                          try/catch → Response.json             │
│       │                                                        │
│       ▼                                                        │
│  app/lib/db.js (Neon sql)   app/lib/auth.js (getDbUser)        │
│  app/lib/email.js (Nodemailer: Resend SMTP | local SMTP)       │
└───────┼────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Neon Postgres  — users + domain tables (idempotent migrate)   │
└─────────────────────────────────────────────────────────────┘

Deploy:  next build  →  postbuild: node scripts/migrate.js  (idempotent)
```

### Why these choices

- **Neon serverless driver + tagged-template `sql`.** Works over HTTP from serverless
  functions without connection-pool management; `fetchConnectionCache: true` reuses
  connections. Tagged templates parameterize queries, preventing SQL injection by default.
- **Clerk for auth.** Provides registration, login, logout, password recovery, and session
  management out of the box, with first-class Next.js middleware. Removes the need to build
  custom credential/token handling (satisfies the multi-user-readiness requirement without
  reinventing security primitives).
- **IndexedDB as source of truth.** The only browser storage able to hold structured,
  queryable workout data durably across reloads and restarts, and large enough for full
  session history. `localStorage` is too small/synchronous; in-memory state is not durable.
- **Idempotent sync via client-generated IDs.** iOS restricts background execution, so sync
  cannot rely on Background Sync APIs or `online`/`offline` events alone. Stable UUIDs plus
  server-side upserts make retries safe and exactly-once in effect.

## Milestone 0 — Foundation (built first)

Exactly the Prompt 1 deliverables. No domain tables/routes/UI beyond the placeholders.

### File layout

```
app/
  layout.js                        # Root layout, <ClerkProvider>
  page.js                          # Public landing placeholder
  globals.css                      # Minimal placeholder styles
  lib/
    db.js                          # Neon sql client
    auth.js                        # getDbUser()
    email.js                       # sendEmail()
  sign-in/[[...sign-in]]/page.js   # <SignIn />
  sign-up/[[...sign-up]]/page.js   # <SignUp />
  api/
    user/route.js                  # GET current user (placeholder, follows convention)
middleware.ts                      # Clerk middleware + route matcher
scripts/
  migrate.js                       # Idempotent migration runner (users table only)
__tests__/
  setup.js                         # Shared Jest ESM mocks + helpers
  api/user.test.js                 # Example route test
jest.config.js
jsconfig.json
.gitignore
.env.example
package.json
```

### Key module contracts

**`app/lib/db.js`**
```js
import { neon } from '@neondatabase/serverless';
export const sql = neon(process.env.DATABASE_URL, { fetchConnectionCache: true });
```

**`app/lib/auth.js`**
```js
import { auth } from '@clerk/nextjs/server';
import { sql } from '@/app/lib/db';

export async function getDbUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const rows = await sql`SELECT * FROM users WHERE clerk_user_id = ${userId}`;
  return rows[0] ?? null;
}
```

**`app/lib/email.js`** — `sendEmail({ to, subject, html })`. Transport selection:
`RESEND_API_KEY` present → Resend SMTP (`smtp.resend.com:465`, secure); otherwise
`SMTP_HOST`/`SMTP_PORT` defaulting to `localhost:1025`. Sender from `EMAIL_FROM`. Send wrapped
in try/catch; failures logged, never thrown.

**`middleware.ts`** — `clerkMiddleware` + `createRouteMatcher`. Protected:
`/dashboard(.*)`, `/admin(.*)`, `/api(.*)`. Exempt: `/api/webhooks(.*)`. Standard
`config.matcher` skipping Next internals and static assets.

**`scripts/migrate.js`** — loads `.env.local` via dotenv, builds a Neon `sql` client, runs
each `CREATE TABLE IF NOT EXISTS` in a try/catch logging per-table progress; `process.exit(1)`
on failure. Milestone 0 creates only:
```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```
Written so later tables are appended following the same pattern.

### API route convention (applies to all later routes too)

```js
import { getDbUser } from '@/app/lib/auth';

export async function GET(request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    // validate input → 400 on bad input
    // do work
    return Response.json({ user });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Testing harness

- `jest.config.js`: `testEnvironment: 'node'`, `transform: {}`,
  `moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' }`,
  `testPathIgnorePatterns: ['/node_modules/', '__tests__/setup\\.js']`.
- `__tests__/setup.js`: exports `mockSql`, `mockGetDbUser`, Clerk `auth` mock, all registered
  with `jest.unstable_mockModule` before route imports; plus `resetMocks()` and
  `makeRequest(url, opts)` (sets JSON content-type).
- `__tests__/api/user.test.js`: dynamically imports the handler in `beforeEach` after
  `resetMocks()`; asserts 401 when `mockGetDbUser` resolves `null`, and the user payload when
  authenticated. The same pattern extends to cross-user access tests in later milestones.

### Milestone 0 verification

`npm install` → `npm test` (user-route tests green) → `npm run build`. Live DB connectivity is
not verifiable without real env vars and is reported as such.

## Domain architecture (later milestones)

### Data model

Entities and relationships (snapshot-on-start isolates history from template edits):

```
users (1)──<(N) workout_templates (1)──<(N) template_exercises >──(1) exercises
   │                                                                     │
   │                                                              exercise_muscles
   │                                                                     │
   │                                                             (N)>── muscle_groups
   │
   └──<(N) training_sessions (1)──<(N) session_exercises (1)──<(N) workout_sets
                   │
             (snapshot of template at start; never mutated by later template edits)

sync_change_log  — per-user record of applied client change IDs (idempotency ledger)
```

Core columns (indicative; finalized before migration in the data-model task):

- **exercises**: `id`, `owner_user_id` (nullable → shared), `name`, `primary_muscle_group_id`,
  `equipment`, `movement_category`, `description`, timestamps. Secondary muscles via
  `exercise_muscles(exercise_id, muscle_group_id, role)`.
- **muscle_groups**: `id`, `name`. Seeded, not hardcoded in the frontend.
- **workout_templates**: `id`, `owner_user_id`, `name`, `is_archived`, timestamps.
- **template_exercises**: `id`, `template_id`, `exercise_id`, `position`, `target_sets`,
  `target_rep_min`, `target_rep_max`, `target_weight`, `rest_seconds`.
- **training_sessions**: `id` (UUID, client-generatable), `owner_user_id`, `template_id`
  (nullable for blank), `name`/`type` snapshot, `started_at`, `finished_at` (null = in
  progress), `status`, timestamps.
- **session_exercises**: `id` (UUID), `session_id`, `exercise_id`, `position`, `skipped`,
  snapshotted targets.
- **workout_sets**: `id` (UUID), `session_exercise_id`, `set_order`, `weight`, `weight_unit`,
  `reps`, `completed`, `set_type` (`working` | `warmup`), `created_at`, `updated_at`.
  Extensible for RIR/RPE/duration/distance via nullable columns added later.
- **sync_change_log**: `id`, `owner_user_id`, `client_change_id` (unique per user),
  `applied_at`.

Ownership is enforced in every query (`WHERE owner_user_id = ${user.id}`); the client-supplied
user id is never trusted.

### Offline + sync design

- **Local store:** IndexedDB object stores mirroring sessions, session_exercises, sets, plus a
  `pending_changes` queue. All entity IDs are client-generated UUIDs so records exist locally
  before any server round-trip.
- **Write path:** UI → write to IndexedDB (durable) → enqueue change → UI confirms "saved
  locally". Only server acknowledgement flips state to "synced".
- **Sync engine:** batches pending changes and POSTs them to an idempotent sync endpoint.
  Triggered on app open, `visibilitychange`/focus, `online`, and manual retry — never relying
  solely on Background Sync. Retries use exponential backoff.
- **Idempotency:** each change carries a `client_change_id`; the server records applied IDs in
  `sync_change_log` and upserts by entity UUID, so replays are no-ops. A real connectivity
  probe (an app-level request), not `navigator.onLine`, decides reachability.
- **Conflict policy (documented):** last-write-wins per field using `updated_at`, except
  completed historical sessions are immutable once `finished_at` is set server-side. Conflicts
  are detected via version/updated_at comparison and surfaced in sync status.
- **Durability guarantee:** a failed sync leaves IndexedDB untouched; nothing is deleted until
  the server acknowledges.

### Analytics foundation

Working volume = sum over completed, non-warm-up sets. Muscle-group volume attributes full
credit to the primary muscle group and fractional credit to secondaries (ratio documented in
the analytics task), avoiding counting every set as full volume everywhere. All metrics are
derived from `workout_sets` at query time; no authoritative aggregate tables in the MVP.

### PWA / UX

- `manifest.json` + icons for Home Screen install; service worker caches the app shell and
  static assets for offline launch.
- Mobile-first layout; set-entry controls kept within thumb reach; large numeric inputs;
  minimal navigation during a live session.
- Visible sync/connectivity indicator; explicit saved/pending/error feedback.
- Unit handling stores a canonical value with an explicit unit; conversions are computed, not
  destructive, preserving the intended physical value.

## Error handling

- **API:** convention returns 401/400/500 with `Response.json`; server-side logging on 500.
- **Migrations:** per-table try/catch with progress logs; `process.exit(1)` on failure so a
  bad deploy fails loudly.
- **Email:** failures logged, never thrown, so transactional flows don't crash on SMTP issues.
- **Sync:** retryable failures backed off and retried; non-retryable (validation/authz)
  surfaced to the user without destroying local data.

## Testing strategy

- **Unit/route (Jest ESM):** the `__tests__/setup.js` mock harness drives route tests with
  mocked `sql`, `getDbUser`, and Clerk `auth`. Covers auth (401), validation (400), success,
  and — for domain routes — cross-user access denial.
- **Sync tests:** idempotency (replayed `client_change_id` is a no-op), out-of-order updates,
  and "failed sync preserves local data".
- **Analytics tests:** weekly volume excludes warm-up/incomplete sets and follows the
  documented muscle-group attribution rule; unit conversions preserve physical values.
- **Manual (user-performed, agent cannot verify):** real-iPhone offline test — install to Home
  Screen, record a full session in airplane mode, close/reopen without data loss, sync on
  reconnect. Flagged explicitly in acceptance.

## Deployment

Serverless (Vercel-style). `next build` then `postbuild` runs `node scripts/migrate.js`
against `DATABASE_URL`, shipping idempotent schema changes with each deploy. No separate CI
file required. Secrets provided via host env vars; never committed (`.gitignore` covers
`.env*.local`), documented in `.env.example`.
