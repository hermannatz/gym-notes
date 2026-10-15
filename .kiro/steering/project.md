# GymNotes — project steering

GymNotes is a mobile-first, offline-first PWA for planning, recording, and
reviewing gym workouts. Core principle: recording a set must be fast, reliable,
and work offline.

This project is developed with more than one AI agent (Kiro and Codex). The
shared, authoritative conventions live in **`AGENTS.md`** at the repo root — treat
it as the canonical rules for how we build here, and keep this file in sync with it.

## Source of truth

Read the spec before changing related code; it is kept current per milestone:

- #[[file:.kiro/specs/workout-tracker/requirements.md]]
- #[[file:.kiro/specs/workout-tracker/design.md]]
- #[[file:.kiro/specs/workout-tracker/tasks.md]]

The full conventions are in #[[file:AGENTS.md]]. Key points:

- **Stack:** Node.js 22 LTS, Next.js 16 / React 19 (ESM), Neon serverless Postgres (tagged `sql`),
  Clerk auth, Nodemailer, Jest 30 ESM, serverless deploy with migrations on `postbuild`.
- **API convention:** auth (`getDbUser()` → 401) → validate (→ 400) → try/catch (→ 500);
  always `Response.json(...)`.
- **Authorization:** enforced in SQL; never trust a client-supplied user id; foreign
  resources return 404 (no existence leak).
- **Migrations:** idempotent, appended to `scripts/migrate.js`; one statement per Neon
  tagged-template call; `sql.transaction([...])` for atomic multi-writes.
- **Testing:** Jest ESM with `__tests__/setup.js` mocks (dynamic route import after
  `resetMocks()`); cover 401/400/500 and cross-user denial; validate non-trivial SQL
  against a throwaway Docker Postgres before committing.
- **Design:** dark-first, one electric-lime accent, tabular numerals; use the CSS tokens
  in `app/globals.css`, don't hardcode colors.
- **Verify** with `npx next build` and `npm test` before calling work done.
- **Never commit secrets**; keep the specs updated as the shared decision log.
