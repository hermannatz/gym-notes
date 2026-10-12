import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * GET /api/templates — list the current user's templates (excluding archived),
 * with a count of exercises in each.
 */
export async function GET() {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const templates = await sql`
      SELECT
        t.id, t.name, t.is_archived, t.created_at, t.updated_at,
        COUNT(te.id)::int AS exercise_count
      FROM workout_templates t
      LEFT JOIN template_exercises te ON te.template_id = t.id
      WHERE t.owner_user_id = ${user.id}
        AND t.is_archived = FALSE
      GROUP BY t.id
      ORDER BY t.updated_at DESC
    `;
    return Response.json({ templates });
  } catch (err) {
    console.error('GET /api/templates failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates — create a template owned by the current user.
 */
export async function POST(request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    const rows = await sql`
      INSERT INTO workout_templates (owner_user_id, name)
      VALUES (${user.id}, ${name})
      RETURNING id, name, is_archived, created_at, updated_at
    `;
    return Response.json({ template: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('POST /api/templates failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
