import 'dotenv/config';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load .env.local explicitly for local script runs. In deployment the
// environment variables are provided by the host.
config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL, { fetchConnectionCache: true });

/**
 * Each migration is a named, idempotent CREATE TABLE IF NOT EXISTS statement.
 * Append new tables to this list following the same pattern; migrations run on
 * every build via the `postbuild` script, so they must stay idempotent.
 */
const migrations = [
  {
    name: 'users',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT UNIQUE NOT NULL,
        email TEXT,
        name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },

  // --- Milestone 1: domain model ---------------------------------------

  // Add the user's preferred display unit. Idempotent for existing rows.
  {
    name: 'users.preferred_unit',
    run: () => sql`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS preferred_unit TEXT NOT NULL DEFAULT 'kg';
    `,
  },

  // Reference taxonomy. Seeded, never client-created, so a SERIAL id is fine.
  {
    name: 'muscle_groups',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS muscle_groups (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },

  // Exercises. owner_user_id NULL => shared/global exercise; non-null =>
  // personal exercise. UUID so personal exercises can be created offline.
  {
    name: 'exercises',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS exercises (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        primary_muscle_group_id INTEGER REFERENCES muscle_groups(id) ON DELETE SET NULL,
        equipment TEXT,
        movement_category TEXT,
        description TEXT,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },

  // Secondary muscle involvement (many-to-many), with a role for future
  // weighted volume attribution.
  {
    name: 'exercise_muscles',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS exercise_muscles (
        exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        muscle_group_id INTEGER NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'secondary',
        PRIMARY KEY (exercise_id, muscle_group_id)
      );
    `,
  },

  // Reusable workout templates. Soft-deleted via is_archived.
  {
    name: 'workout_templates',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS workout_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        is_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },

  // Exercises planned within a template, with optional targets.
  {
    name: 'template_exercises',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS template_exercises (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
        exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
        position INTEGER NOT NULL DEFAULT 0,
        target_sets INTEGER,
        target_rep_min INTEGER,
        target_rep_max INTEGER,
        target_weight NUMERIC(7, 2),
        rest_seconds INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },

  // A training session. UUID so it can be created offline. template_id is
  // nullable for blank sessions; the planned sequence is snapshotted into
  // session_exercises at start so later template edits never alter history.
  {
    name: 'training_sessions',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS training_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        template_id UUID REFERENCES workout_templates(id) ON DELETE SET NULL,
        name TEXT,
        status TEXT NOT NULL DEFAULT 'in_progress',
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },

  // Snapshot of an exercise within a session. Keeps a reference to the source
  // exercise plus snapshotted planned targets.
  {
    name: 'session_exercises',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS session_exercises (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
        exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
        position INTEGER NOT NULL DEFAULT 0,
        skipped BOOLEAN NOT NULL DEFAULT FALSE,
        target_sets INTEGER,
        target_rep_min INTEGER,
        target_rep_max INTEGER,
        target_weight NUMERIC(7, 2),
        rest_seconds INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },

  // Individual recorded sets. UUID + client-generatable for offline entry.
  {
    name: 'workout_sets',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS workout_sets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_exercise_id UUID NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
        set_order INTEGER NOT NULL DEFAULT 0,
        weight NUMERIC(7, 2),
        weight_unit TEXT NOT NULL DEFAULT 'kg',
        reps INTEGER,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        set_type TEXT NOT NULL DEFAULT 'working',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `,
  },

  // Idempotency ledger for sync. A (owner_user_id, client_change_id) pair is
  // recorded once a change is applied; replays become no-ops.
  {
    name: 'sync_change_log',
    run: () => sql`
      CREATE TABLE IF NOT EXISTS sync_change_log (
        id BIGSERIAL PRIMARY KEY,
        owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_change_id UUID NOT NULL,
        entity_type TEXT,
        entity_id UUID,
        applied_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (owner_user_id, client_change_id)
      );
    `,
  },

  // Indexes for common ownership / ordering lookups. The Neon HTTP driver
  // runs one statement per tagged-template call, so each index is its own.
  {
    name: 'idx_exercises_owner',
    run: () => sql`CREATE INDEX IF NOT EXISTS idx_exercises_owner ON exercises(owner_user_id);`,
  },
  {
    name: 'idx_templates_owner',
    run: () => sql`CREATE INDEX IF NOT EXISTS idx_templates_owner ON workout_templates(owner_user_id);`,
  },
  {
    name: 'idx_template_exercises_template',
    run: () => sql`CREATE INDEX IF NOT EXISTS idx_template_exercises_template ON template_exercises(template_id);`,
  },
  {
    name: 'idx_sessions_owner',
    run: () => sql`CREATE INDEX IF NOT EXISTS idx_sessions_owner ON training_sessions(owner_user_id);`,
  },
  {
    name: 'idx_session_exercises_session',
    run: () => sql`CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON session_exercises(session_id);`,
  },
  {
    name: 'idx_workout_sets_session_exercise',
    run: () => sql`CREATE INDEX IF NOT EXISTS idx_workout_sets_session_exercise ON workout_sets(session_exercise_id);`,
  },
  {
    name: 'idx_sync_log_owner',
    run: () => sql`CREATE INDEX IF NOT EXISTS idx_sync_log_owner ON sync_change_log(owner_user_id);`,
  },

  // Seed the baseline muscle-group taxonomy. Idempotent via ON CONFLICT.
  {
    name: 'seed_muscle_groups',
    run: () => sql`
      INSERT INTO muscle_groups (name) VALUES
        ('Chest'), ('Back'), ('Shoulders'), ('Biceps'), ('Triceps'),
        ('Forearms'), ('Quadriceps'), ('Hamstrings'), ('Glutes'),
        ('Calves'), ('Core'), ('Traps'), ('Lats'), ('Adductors'),
        ('Abductors'), ('Neck')
      ON CONFLICT (name) DO NOTHING;
    `,
  },
];

async function migrate() {
  try {
    for (const migration of migrations) {
      console.log(`Running migration: ${migration.name}`);
      await migration.run();
      console.log(`  ✓ ${migration.name}`);
    }
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
