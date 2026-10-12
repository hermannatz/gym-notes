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
