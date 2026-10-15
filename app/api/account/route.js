import { auth, clerkClient } from '@clerk/nextjs/server';
import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * DELETE /api/account — permanently delete the current user's account and all
 * of their data (templates, exercises, sessions, sets).
 *
 * Order:
 *   1. Delete the local `users` row — this cascades to every owned record via
 *      ON DELETE CASCADE (the data we are responsible for).
 *   2. Delete the Clerk user so the identity is removed too. If this step
 *      fails, the data is already gone and Clerk's user.deleted webhook keeps
 *      things consistent; we surface a partial-success note.
 *
 * This is irreversible. Ownership is implicit: we only ever act on the
 * authenticated user's own row.
 */
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Remove all local data (cascades through owned tables).
    await sql`DELETE FROM users WHERE id = ${user.id}`;

    // 2. Remove the Clerk identity.
    try {
      const client = await clerkClient();
      await client.users.deleteUser(userId);
    } catch (clerkErr) {
      console.error('Account deleted locally; Clerk deletion failed:', clerkErr);
      // Data is gone; identity cleanup will reconcile via the webhook.
      return Response.json({ ok: true, clerkDeleted: false });
    }

    return Response.json({ ok: true, clerkDeleted: true });
  } catch (err) {
    console.error('DELETE /api/account failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
