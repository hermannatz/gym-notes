import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * GET /api/analytics/exercise/:exerciseId
 *
 * Per-exercise progression over the caller's completed/abandoned sessions:
 * for each session that trained this exercise, the working volume (kg) and the
 * top working set (heaviest completed non-warm-up set). Derived at query time.
 *
 * The exercise must be visible to the caller (shared or owned); otherwise 404.
 */
export async function GET(_request, { params }) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { exerciseId } = await params;

  try {
    // Confirm the exercise is visible to the user (no leak of others' private).
    const ex = await sql`
      SELECT id, name FROM exercises
      WHERE id = ${exerciseId}
        AND (owner_user_id IS NULL OR owner_user_id = ${user.id})
    `;
    if (!ex[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const points = await sql`
      WITH working AS (
        SELECT
          s.id AS session_id,
          s.started_at,
          CASE WHEN ws.weight_unit = 'lb'
            THEN ws.weight / 2.2046226218 ELSE ws.weight END AS weight_kg,
          ws.reps
        FROM workout_sets ws
        JOIN session_exercises se ON se.id = ws.session_exercise_id
        JOIN training_sessions s ON s.id = se.session_id
        WHERE s.owner_user_id = ${user.id}
          AND se.exercise_id = ${exerciseId}
          AND ws.completed = TRUE
          AND ws.set_type <> 'warmup'
          AND ws.weight IS NOT NULL
          AND ws.reps IS NOT NULL
      )
      SELECT
        session_id,
        started_at,
        ROUND(SUM(weight_kg * reps))::int AS volume_kg,
        ROUND(MAX(weight_kg))::int AS top_weight_kg
      FROM working
      GROUP BY session_id, started_at
      ORDER BY started_at ASC
    `;

    return Response.json({
      exercise: ex[0],
      unit: 'kg',
      points,
    });
  } catch (err) {
    console.error('GET /api/analytics/exercise/:exerciseId failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
