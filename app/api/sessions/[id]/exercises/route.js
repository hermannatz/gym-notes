import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * POST /api/sessions/:id/exercises — add an exercise to an in-progress
 * session. The session must be owned by the user and the exercise visible
 * (shared or owned). Position defaults to the end.
 */
export async function POST(request, { params }) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const exerciseId =
    typeof body?.exercise_id === 'string' ? body.exercise_id : null;
  if (!exerciseId) {
    return Response.json({ error: 'exercise_id is required' }, { status: 400 });
  }

  try {
    const session = await sql`
      SELECT id FROM training_sessions
      WHERE id = ${id} AND owner_user_id = ${user.id}
    `;
    if (!session[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const ex = await sql`
      SELECT id FROM exercises
      WHERE id = ${exerciseId}
        AND is_archived = FALSE
        AND (owner_user_id IS NULL OR owner_user_id = ${user.id})
    `;
    if (!ex[0]) {
      return Response.json(
        { error: 'exercise_id is not a valid exercise' },
        { status: 400 }
      );
    }

    const next = await sql`
      SELECT COALESCE(MAX(position), -1) + 1 AS next
      FROM session_exercises WHERE session_id = ${id}
    `;

    const rows = await sql`
      INSERT INTO session_exercises (session_id, exercise_id, position)
      VALUES (${id}, ${exerciseId}, ${next[0].next})
      RETURNING id, exercise_id, position, skipped
    `;
    return Response.json({ sessionExercise: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('POST session exercise failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
