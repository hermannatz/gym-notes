import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * POST /api/templates/:id/exercises — add an exercise to the user's template.
 *
 * Validates that:
 *   - the template is owned by the user (404 otherwise)
 *   - the exercise_id is visible to the user (shared or owned) and not archived
 * Position defaults to the end of the list when not supplied.
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
    return Response.json(
      { error: 'exercise_id is required' },
      { status: 400 }
    );
  }

  // Optional numeric targets — validate when present.
  const intFields = ['target_sets', 'target_rep_min', 'target_rep_max', 'rest_seconds'];
  const values = {};
  for (const f of intFields) {
    if (body[f] === undefined || body[f] === null) {
      values[f] = null;
    } else {
      const n = Number(body[f]);
      if (!Number.isInteger(n) || n < 0) {
        return Response.json(
          { error: `${f} must be a non-negative integer` },
          { status: 400 }
        );
      }
      values[f] = n;
    }
  }
  let targetWeight = null;
  if (body.target_weight !== undefined && body.target_weight !== null) {
    const w = Number(body.target_weight);
    if (!Number.isFinite(w) || w < 0) {
      return Response.json(
        { error: 'target_weight must be a non-negative number' },
        { status: 400 }
      );
    }
    targetWeight = w;
  }

  try {
    // Ownership of the template.
    const tpl = await sql`
      SELECT id FROM workout_templates
      WHERE id = ${id} AND owner_user_id = ${user.id}
    `;
    if (!tpl[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // The exercise must be visible to the user (shared or owned) and active.
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

    // Default position to the end of the current list.
    let position;
    if (body.position !== undefined) {
      const p = Number(body.position);
      if (!Number.isInteger(p) || p < 0) {
        return Response.json(
          { error: 'position must be a non-negative integer' },
          { status: 400 }
        );
      }
      position = p;
    } else {
      const maxRows = await sql`
        SELECT COALESCE(MAX(position), -1) + 1 AS next
        FROM template_exercises WHERE template_id = ${id}
      `;
      position = maxRows[0].next;
    }

    const rows = await sql`
      INSERT INTO template_exercises
        (template_id, exercise_id, position, target_sets, target_rep_min,
         target_rep_max, target_weight, rest_seconds)
      VALUES
        (${id}, ${exerciseId}, ${position}, ${values.target_sets},
         ${values.target_rep_min}, ${values.target_rep_max}, ${targetWeight},
         ${values.rest_seconds})
      RETURNING id, exercise_id, position, target_sets, target_rep_min,
        target_rep_max, target_weight, rest_seconds
    `;
    return Response.json({ templateExercise: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('POST /api/templates/:id/exercises failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
