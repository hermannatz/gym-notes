import { auth } from '@clerk/nextjs/server';
import { sql } from '@/app/lib/db';

/**
 * Resolve the current application user from Clerk's session.
 *
 * Returns null when there is no authenticated Clerk session, otherwise the
 * matching row from the `users` table keyed by clerk_user_id. Identity is
 * derived server-side from Clerk — never from client-supplied values.
 */
export async function getDbUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const rows = await sql`
    SELECT * FROM users WHERE clerk_user_id = ${userId}
  `;

  return rows[0] ?? null;
}
