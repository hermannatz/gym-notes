import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * GET /api/muscle-groups — list the seeded muscle-group taxonomy.
 *
 * Reference data shared by all users. Returned from the database so the
 * frontend never hardcodes muscle-group names.
 */
export async function GET() {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const muscleGroups = await sql`
      SELECT id, name FROM muscle_groups ORDER BY name ASC
    `;
    return Response.json({ muscleGroups });
  } catch (err) {
    console.error('GET /api/muscle-groups failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
