import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';
import {
  PRIMARY_MUSCLE_FACTOR,
  SECONDARY_MUSCLE_FACTOR,
} from '@/app/lib/metrics';

/**
 * GET /api/analytics/volume-by-muscle?weeks=N
 *
 * Weekly working-set volume per muscle group, derived from recorded sets.
 * Rules (documented in app/lib/metrics.js and the design doc):
 *   - Only completed, non-warm-up ("working") sets count.
 *   - Volume = weight (normalized to kg) * reps.
 *   - A set credits its exercise's PRIMARY muscle at full weight and each
 *     SECONDARY muscle (from exercise_muscles) at a reduced share, so a set is
 *     not counted as full volume for every muscle it touches.
 *   - Metrics are derived at query time; no aggregate tables.
 *
 * Default window: 8 weeks. Only the caller's own sessions are considered.
 */
export async function GET(request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const weeksRaw = searchParams.get('weeks');
  let weeks = 8;
  if (weeksRaw !== null) {
    const n = Number(weeksRaw);
    if (!Number.isInteger(n) || n < 1 || n > 52) {
      return Response.json(
        { error: 'weeks must be an integer between 1 and 52' },
        { status: 400 }
      );
    }
    weeks = n;
  }

  try {
    // Normalize weight to kg in SQL (lb -> kg) so mixed-unit sessions sum
    // correctly, matching convertWeight() in app/lib/metrics.js. Each working
    // set contributes to its primary muscle (full) and secondaries (reduced),
    // bucketed by ISO week of the session start.
    const rows = await sql`
      WITH working AS (
        SELECT
          s.started_at,
          CASE WHEN ws.weight_unit = 'lb'
            THEN ws.weight / 2.2046226218 ELSE ws.weight END * ws.reps AS volume_kg,
          se.exercise_id
        FROM workout_sets ws
        JOIN session_exercises se ON se.id = ws.session_exercise_id
        JOIN training_sessions s ON s.id = se.session_id
        WHERE s.owner_user_id = ${user.id}
          AND ws.completed = TRUE
          AND ws.set_type <> 'warmup'
          AND ws.weight IS NOT NULL
          AND ws.reps IS NOT NULL
          AND s.started_at >= NOW() - (${weeks} * INTERVAL '7 days')
      ),
      -- Primary muscle lives on exercises.primary_muscle_group_id (full credit).
      -- Secondary muscles come from exercise_muscles (reduced credit).
      attributed AS (
        SELECT
          date_trunc('week', w.started_at)::date AS week,
          e.primary_muscle_group_id AS muscle_group_id,
          w.volume_kg * ${PRIMARY_MUSCLE_FACTOR} AS credited
        FROM working w
        JOIN exercises e ON e.id = w.exercise_id
        WHERE e.primary_muscle_group_id IS NOT NULL

        UNION ALL

        SELECT
          date_trunc('week', w.started_at)::date AS week,
          em.muscle_group_id,
          w.volume_kg * ${SECONDARY_MUSCLE_FACTOR} AS credited
        FROM working w
        JOIN exercise_muscles em
          ON em.exercise_id = w.exercise_id AND em.role <> 'primary'
      )
      SELECT a.week, mg.name AS muscle_group, ROUND(SUM(a.credited))::int AS volume_kg
      FROM attributed a
      JOIN muscle_groups mg ON mg.id = a.muscle_group_id
      GROUP BY a.week, mg.name
      ORDER BY a.week ASC, mg.name ASC
    `;

    return Response.json({ weeks, unit: 'kg', data: rows });
  } catch (err) {
    console.error('GET /api/analytics/volume-by-muscle failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
