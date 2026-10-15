# Implementation Plan — Offline-First Workout Tracker

> **Scope decision (2026-10-15): offline deferred, not dropped.** The near-term goal is
> a shippable **online-first MVP**. Milestones 6 (offline persistence/PWA) and 7 (sync
> engine) are intentionally deferred until the online product is complete and polished,
> because they are the most complex and hardest-to-reverse work and are lower-risk once
> the data model and UI have settled. Offline remains the headline next-version feature
> and the long-term definition of full MVP success (see "Definition of MVP success" in
> requirements.md). Near-term order: **M8 Analytics → Settings + UX polish → M9 Security
> hardening → PWA install (manifest/icons)**, then revisit offline (M6/M7).

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

- [x] 10. Milestone 3 — Templates (API + UI)
  - Create/rename/duplicate/edit/archive templates; add/reorder exercises; targets.
  - Routes: `GET`/`POST /api/templates`; `GET`/`PATCH`/`DELETE /api/templates/[id]`;
    `POST /api/templates/[id]/duplicate`; `POST /api/templates/[id]/exercises`;
    `PATCH`/`DELETE /api/templates/[id]/exercises/[teId]`;
    `PUT /api/templates/[id]/exercises/order` (atomic reorder via sql.transaction).
  - Ownership enforced in SQL (incl. subquery guards for nested rows); foreign access 404.
  - Added exercises must be visible to the user (shared or owned); archive = soft-delete.
  - UI: `/templates` list (create/duplicate/archive) + `/templates/[id]` editor
    (rename, add, up/down reorder, remove, target sets). Dashboard links enabled.
  - 22 new tests incl. cross-user denial (48 total); SQL validated against Postgres 16.
  - NOTE: snapshot-on-start deferred to Milestone 4 (session creation).
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 13.4_

- [x] 11. Milestone 4 — Live session + set logging
  - Start from template (snapshot-on-start, atomic via sql.transaction) or blank.
  - Routes: sessions CRUD + status (finish/abandon/resume); session-exercise add/skip/
    reorder/remove; previous-performance query; set add/edit/delete.
  - Snapshot-on-start copies template_exercises into session_exercises so later template
    edits never change history (validated against Postgres 16).
  - Ownership enforced in SQL at every nesting level (session -> exercise -> set); 404 on
    foreign access.
  - UI: `/train` (start/resume) + `/train/[id]` (set-entry table, mark/add/edit/delete sets,
    show-last-time, add/skip/remove exercise, finish/abandon). Dashboard card enabled.
  - 24 new tests incl. cross-user denial (72 total).
  - _Requirements: 5.*, 6.*, 7.2, 3.5, 13.4_

- [x] 12. Milestone 5 — Training history
  - Browse/open completed sessions; actual-vs-planned distinction; resume unfinished.
  - Reuses the existing sessions API (no new routes/migration).
  - `app/lib/metrics.js` — shared working-volume rules (completed, non-warm-up only),
    unit-tested; used by history summaries and future analytics.
  - UI: `/history` (unfinished + completed lists, resume links) and `/history/[id]`
    (read-only session with per-exercise working-set count + volume). Dashboard card enabled.
  - 5 new metrics tests (77 total).
  - _Requirements: 7.1, 7.2, 6.4_

- [x] 12.1 Onboarding maintenance and integrity hardening
  - Standardize local development on Node.js 22 LTS (`engines`, `.nvmrc`, README).
  - Enforce immutable completed/abandoned sessions and complete nested URL scoping in SQL.
  - Normalize mixed kg/lb history volume to kilograms before summing.
  - Surface template mutation failures and expose all existing exercise target fields.
  - Add regression tests for status guards, URL hierarchy, and unit conversion.

- [x] 12.2 Mobile application UI refinement
  - Add the authenticated app shell with persistent mobile navigation and a focused
    live-session mode.
  - Rework the dashboard hierarchy around the primary training action.
  - Refine live set entry with automatic previous-performance context, large numeric inputs,
    clear completion states, progress, confirmations, and save/error feedback.
  - Compact template planning into scannable summaries with expandable target editing.
  - Standardize cards, section headings, loading states, safe-area spacing, focus styles, and
    reduced-motion behavior across templates, exercises, training, and history.
  - No new dependencies, schema changes, or claims of offline synchronization.
  - _Requirements: 5.2, 5.3, 5.5, 12.1, 12.2, 12.3, 12.5_

- [ ] 13. Milestone 6 — Offline persistence + PWA shell  **(DEFERRED — post online-MVP)**
  - IndexedDB local store (UUID IDs, pending-changes queue); service worker + manifest; install
    to Home Screen; durable write path; sync-status UI.
  - Deferred by the 2026-10-15 scope decision; the data model already uses client-generatable
    UUIDs to keep this path open. (PWA install — manifest/icons — may be done earlier on its
    own, independent of offline.)
  - _Requirements: 8.*, 12.1, 12.2, 12.3_

- [ ] 14. Milestone 7 — Synchronization engine + idempotent endpoints  **(DEFERRED — post online-MVP)**
  - Idempotent sync endpoint (client_change_id ledger, UUID upserts); triggers on open/focus/
    online/manual; backoff; connectivity probe; documented conflict policy; server-side
    validation/authz. Tests: idempotent replay, out-of-order, failed-sync preserves local data.
  - Deferred by the 2026-10-15 scope decision; `sync_change_log` table already exists for this.
  - _Requirements: 9.*, 13.3_

- [x] 15. Milestone 8 — Analytics foundation
  - Derived volume/progression queries; documented muscle-group attribution; unit-conversion
    correctness. Tests exclude warm-up/incomplete sets by default.
  - Routes: `GET /api/analytics/volume-by-muscle?weeks=N` (weekly volume per muscle group,
    primary full + secondary 0.5 credit, lb→kg normalized) and
    `GET /api/analytics/exercise/[exerciseId]` (per-session volume + top set).
  - Attribution factors documented and single-sourced in `app/lib/metrics.js`
    (PRIMARY=1, SECONDARY=0.5); primary muscle from `exercises`, secondaries from
    `exercise_muscles`, via UNION ALL. All derived at query time; no aggregate tables.
  - UI: `/progress` page (volume-by-muscle bars + exercise progression table), linked from
    the dashboard. Ownership scoped to the user; cross-user noise excluded (validated).
  - 10 new tests (89 total); the two analytics queries validated against Postgres 16.
  - _Requirements: 10.1, 10.2, 10.3, 12.4_

- [x] 15b. Settings + UX polish (online-MVP readiness)
  - `GET`/`PATCH /api/settings` for `preferred_unit` ('kg'|'lb'); `/settings` page with a
    segmented toggle; Settings link in the app-shell header.
  - Preferred unit wired through display: `/progress` and `/history/[id]` convert canonical
    kg to the user's unit via `convertWeight`/`totalVolume(targetUnit)`; stored values
    unchanged (non-destructive). `formatWeight` helper added to `app/lib/metrics.js`.
  - Confirmation prompts on destructive actions (template archive here; the live-session
    remove/finish/abandon confirms were added by the collaborator).
  - 8 new tests (97 total).
  - _Requirements: 12.4_

- [x] 16. Milestone 9 — Security hardening + cross-user tests
  - Systematic cross-user denial audit (`__tests__/api/cross-user-access.test.js`): every
    resource route returns 404 (not 403) for a non-owned resource — exercises, templates,
    template-exercises, sessions, session-exercises, sets, analytics.
  - Account deletion: `DELETE /api/account` deletes the local user row (cascades all owned
    data) then the Clerk user; two-step confirm in Settings danger zone. Retention policy
    documented in design.md (private by default, retained while account exists, immediate
    irreversible deletion).
  - Audit: all env access server-only; no secrets client-exposed; generic error responses
    (no raw error/stack leak); HTTPS in prod.
  - 23 new tests (120 total).
  - _Requirements: 11.2, 13.1, 13.4, 13.5_

- [ ] 17. Manual acceptance (user-performed; agent cannot verify)
  - Real-iPhone test: install to Home Screen, record a full session in airplane mode,
    close/reopen without data loss, sync on reconnect, review history.
  - _Requirements: Definition of MVP success; 8.*, 9.*, 12.1_
