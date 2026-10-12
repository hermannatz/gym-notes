# Implementation Plan — Offline-First Workout Tracker

Milestone 0 is the only milestone scoped for immediate implementation. It is exactly the
Prompt 1 foundation — no domain tables, routes, or UI. Later milestones are listed so the
full roadmap is captured, but should not be started until Milestone 0 is installed, tested,
and building green, and until their scope is confirmed.

## Milestone 0 — Foundation (implement now)

- [x] 1. Initialize project configuration and dependencies
  - Create `package.json` with `"type": "module"`, the required scripts (`dev`, `build`,
    `start`, `migrate`, `postbuild`, `test`, `test:watch` with `--experimental-vm-modules`),
    and current stable versions of `@clerk/nextjs`, `@neondatabase/serverless`, `dotenv`,
    `next`, `nodemailer`, `react`, `react-dom`, plus dev deps `@jest/globals`, `jest`.
  - Create `jsconfig.json` with `baseUrl: "."` and `@/*` → `./*`.
  - Create `jest.config.js` (node env, `transform: {}`, `@/` moduleNameMapper, ignore
    node_modules and `__tests__/setup.js`).
  - Create `.gitignore` (`node_modules/`, `.next/`, `.env.local`, `.env*.local`).
  - Create `.env.example` documenting `DATABASE_URL`,
    `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `RESEND_API_KEY` or
    `SMTP_HOST`/`SMTP_PORT`, `EMAIL_FROM` (no secrets).
  - _Requirements: 1.2, 1.3, 1.4, 1.12, 1.15, 1.16_

- [x] 2. Implement the library layer
  - [x] 2.1 `app/lib/db.js` — export `sql` from
    `neon(process.env.DATABASE_URL, { fetchConnectionCache: true })`.
    - _Requirements: 1.5_
  - [x] 2.2 `app/lib/auth.js` — async `getDbUser()` using Clerk `auth()`; `null` when no
    `userId`, else the `users` row keyed by `clerk_user_id`.
    - _Requirements: 1.6, 2.5, 11.2_
  - [x] 2.3 `app/lib/email.js` — async `sendEmail({ to, subject, html })`; Resend SMTP (465)
    when `RESEND_API_KEY`, else `SMTP_HOST`/`SMTP_PORT` (default `localhost:1025`); sender from
    `EMAIL_FROM`; try/catch logs failures without throwing.
    - _Requirements: 1.7_

- [x] 3. Implement Clerk middleware and app shell
  - [x] 3.1 `middleware.ts` — `clerkMiddleware` + `createRouteMatcher`; protect
    `/dashboard(.*)`, `/admin(.*)`, `/api(.*)`; exempt `/api/webhooks(.*)`; standard
    `config.matcher`.
    - _Requirements: 1.8_
  - [x] 3.2 `app/layout.js` — `<ClerkProvider>` with sign-in/sign-up fallback redirects to
    `/dashboard`, placeholder metadata, `<html lang="en">`.
    - _Requirements: 1.9_
  - [x] 3.3 `app/page.js` (public landing placeholder) and `app/globals.css` (minimal).
    - _Requirements: 1.1_
  - [x] 3.4 `app/sign-in/[[...sign-in]]/page.js` and `app/sign-up/[[...sign-up]]/page.js`
    rendering Clerk `<SignIn />` / `<SignUp />`.
    - _Requirements: 1.11_

- [x] 4. Implement the migration runner (users table only)
  - `scripts/migrate.js` — load `.env.local` via dotenv, build Neon `sql`, run
    `CREATE TABLE IF NOT EXISTS users (...)` in a try/catch logging per-table progress;
    `process.exit(1)` on failure; structured so later tables append.
  - _Requirements: 1.10_

- [x] 5. Implement the example authenticated route (placeholder)
  - `app/api/user/route.js` — GET returning the current user via `getDbUser()`, following the
    convention (401 on null, try/catch → 500, `Response.json`).
  - _Requirements: 1.14, 2.1, 2.3, 2.4_

- [x] 6. Implement the Jest ESM test harness and example test
  - [x] 6.1 `__tests__/setup.js` — `mockSql`, `mockGetDbUser`, Clerk `auth` mock registered
    via `jest.unstable_mockModule` before route imports; export `resetMocks()` and
    `makeRequest(url, opts)` (JSON content-type).
    - _Requirements: 1.13_
  - [x] 6.2 `__tests__/api/user.test.js` — dynamic handler import in `beforeEach` after
    `resetMocks()`; cover 401 (null user) and authenticated-success cases.
    - _Requirements: 1.14_

- [x] 7. Verify the foundation
  - Run `npm install`, then `npm test` (confirm user-route tests pass), then `npm run build`
    (confirm compile). Report anything unverifiable (e.g. live DB connection without env vars).
  - _Requirements: 1.17_

---

## Later milestones (roadmap — do not start until Milestone 0 is green and scope is confirmed)

- [x] 8. Milestone 1 — Domain model and migrations
  - Finalize entity columns, relationships, ownership, deletion behaviour, indexes, timestamps,
    and constraints; append domain `CREATE TABLE IF NOT EXISTS` statements to `scripts/migrate.js`
    (exercises, muscle_groups, exercise_muscles, workout_templates, template_exercises,
    training_sessions, session_exercises, workout_sets, sync_change_log). Seed muscle groups.
  - _Requirements: 4.1, 4.2, 6.1, 8.*, 9.*, 10.1, 11.3_

- [x] 9. Milestone 2 — Exercise library (API + UI)
  - CRUD for shared/personal exercises following the API convention; data-driven muscle groups.
  - Routes: `GET /api/muscle-groups`; `GET`/`POST /api/exercises`;
    `GET`/`PATCH`/`DELETE /api/exercises/[id]` (soft-delete via is_archived).
  - Ownership enforced in SQL (shared OR owner = user); foreign access returns 404 (no leak).
  - Mobile-first `/exercises` page: list + add form, muscle groups from the API.
  - 22 tests incl. cross-user denial; queries validated against Postgres 16.
  - _Requirements: 4.1, 4.2, 4.3, 2.*, 13.1, 13.4_

- [ ] 10. Milestone 3 — Templates (API + UI)
  - Create/rename/duplicate/edit/archive templates; add/reorder exercises; targets;
    snapshot-on-start.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 11. Milestone 4 — Live session + set logging
  - Start from template/blank; per-exercise previous performance; record/mark/edit/delete sets;
    add/remove/skip/reorder exercises; finish/abandon/resume.
  - _Requirements: 5.*, 6.*, 7.2_

- [ ] 12. Milestone 5 — Training history
  - Browse/open completed sessions; actual-vs-planned distinction; resume unfinished.
  - _Requirements: 7.1, 7.2_

- [ ] 13. Milestone 6 — Offline persistence + PWA shell
  - IndexedDB local store (UUID IDs, pending-changes queue); service worker + manifest; install
    to Home Screen; durable write path; sync-status UI.
  - _Requirements: 8.*, 12.1, 12.2, 12.3_

- [ ] 14. Milestone 7 — Synchronization engine + idempotent endpoints
  - Idempotent sync endpoint (client_change_id ledger, UUID upserts); triggers on open/focus/
    online/manual; backoff; connectivity probe; documented conflict policy; server-side
    validation/authz. Tests: idempotent replay, out-of-order, failed-sync preserves local data.
  - _Requirements: 9.*, 13.3_

- [ ] 15. Milestone 8 — Analytics foundation
  - Derived volume/progression queries; documented muscle-group attribution; unit-conversion
    correctness. Tests exclude warm-up/incomplete sets by default.
  - _Requirements: 10.1, 10.2, 10.3, 12.4_

- [ ] 16. Milestone 9 — Security hardening + cross-user tests
  - Cross-user access-denial tests on every protected resource; account deletion/retention
    policy; production transport and secret handling review.
  - _Requirements: 11.2, 13.1, 13.4, 13.5_

- [ ] 17. Manual acceptance (user-performed; agent cannot verify)
  - Real-iPhone test: install to Home Screen, record a full session in airplane mode,
    close/reopen without data loss, sync on reconnect, review history.
  - _Requirements: Definition of MVP success; 8.*, 9.*, 12.1_
