import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * PATCH /api/templates/:id/exercises/:teId — update targets/position of a
 * template exercise. Ownership is enforced by requiring the parent template
 * to belong to the user (the UPDATE's WHERE uses a subquery).
 */
export async function PATCH(request, { params }) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, teId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate any supplied integer fields.
  const intFields = [
    'position',
    'target_sets',
    'target_rep_min',
    'target_rep_max',
    'rest_seconds',
  ];
  for (const f of intFields) {
    if (body[f] !== undefined && body[f] !== null) {
      const n = Number(body[f]);
      if (!Number.isInteger(n) || n < 0) {
        return Response.json(
          { error: `${f} must be a non-negative integer` },
          { status: 400 }
        );
      }
    }
  }
  if (body.target_weight !== undefined && body.target_weight !== null) {
    const w = Number(body.target_weight);
    if (!Number.isFinite(w) || w < 0) {
      return Response.json(
        { error: 'target_weight must be a non-negative number' },
        { status: 400 }
      );
    }
  }

  const setField = (key) =>
    body[key] === undefined ? undefined : body[key] === null ? null : body[key];

  try {
    const rows = await sql`
      UPDATE template_exercises te
      SET
        position = CASE WHEN ${body.position !== undefined}
          THEN ${setField('position') ?? null} ELSE position END,
        target_sets = CASE WHEN ${body.target_sets !== undefined}
          THEN ${setField('target_sets') ?? null} ELSE target_sets END,
        target_rep_min = CASE WHEN ${body.target_rep_min !== undefined}
          THEN ${setField('target_rep_min') ?? null} ELSE target_rep_min END,
        target_rep_max = CASE WHEN ${body.target_rep_max !== undefined}
          THEN ${setField('target_rep_max') ?? null} ELSE target_rep_max END,
        target_weight = CASE WHEN ${body.target_weight !== undefined}
          THEN ${setField('target_weight') ?? null} ELSE target_weight END,
        rest_seconds = CASE WHEN ${body.rest_seconds !== undefined}
          THEN ${setField('rest_seconds') ?? null} ELSE rest_seconds END,
        updated_at = NOW()
      WHERE te.id = ${teId}
        AND te.template_id = ${id}
        AND te.template_id IN (
          SELECT id FROM workout_templates WHERE owner_user_id = ${user.id}
        )
      RETURNING te.id, te.exercise_id, te.position, te.target_sets,
        te.target_rep_min, te.target_rep_max, te.target_weight, te.rest_seconds
    `;
    if (!rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ templateExercise: rows[0] });
  } catch (err) {
    console.error('PATCH template exercise failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/:id/exercises/:teId — remove an exercise from the
 * user's template (hard delete; template_exercises carry no history).
 */
export async function DELETE(_request, { params }) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, teId } = await params;

  try {
    const rows = await sql`
      DELETE FROM template_exercises te
      WHERE te.id = ${teId}
        AND te.template_id = ${id}
        AND te.template_id IN (
          SELECT id FROM workout_templates WHERE owner_user_id = ${user.id}
        )
      RETURNING te.id
    `;
    if (!rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('DELETE template exercise failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
