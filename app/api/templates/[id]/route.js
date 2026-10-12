import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * GET /api/templates/:id — a single template owned by the user, with its
 * ordered exercises (joined to exercise + muscle-group names). 404 if the
 * template is not owned by the caller (no existence leak).
 */
export async function GET(_request, { params }) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const templateRows = await sql`
      SELECT id, name, is_archived, created_at, updated_at
      FROM workout_templates
      WHERE id = ${id} AND owner_user_id = ${user.id}
    `;
    if (!templateRows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const exercises = await sql`
      SELECT
        te.id, te.exercise_id, te.position, te.target_sets,
        te.target_rep_min, te.target_rep_max, te.target_weight,
        te.rest_seconds, e.name AS exercise_name,
        mg.name AS primary_muscle_group
      FROM template_exercises te
      JOIN exercises e ON e.id = te.exercise_id
      LEFT JOIN muscle_groups mg ON mg.id = e.primary_muscle_group_id
      WHERE te.template_id = ${id}
      ORDER BY te.position ASC, te.created_at ASC
    `;

    return Response.json({ template: { ...templateRows[0], exercises } });
  } catch (err) {
    console.error('GET /api/templates/:id failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/templates/:id — rename and/or archive-toggle the user's template.
 */
export async function PATCH(request, { params }) {
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

  let name;
  if (body.name !== undefined) {
    name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return Response.json({ error: 'name cannot be empty' }, { status: 400 });
    }
  }

  let isArchived;
  if (body.is_archived !== undefined) {
    if (typeof body.is_archived !== 'boolean') {
      return Response.json(
        { error: 'is_archived must be a boolean' },
        { status: 400 }
      );
    }
    isArchived = body.is_archived;
  }

  try {
    const rows = await sql`
      UPDATE workout_templates
      SET
        name = COALESCE(${name ?? null}, name),
        is_archived = CASE
          WHEN ${body.is_archived !== undefined} THEN ${isArchived ?? false}
          ELSE is_archived
        END,
        updated_at = NOW()
      WHERE id = ${id} AND owner_user_id = ${user.id}
      RETURNING id, name, is_archived, created_at, updated_at
    `;
    if (!rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ template: rows[0] });
  } catch (err) {
    console.error('PATCH /api/templates/:id failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/:id — archive (soft-delete) the user's template so
 * historical sessions that reference it remain intact.
 */
export async function DELETE(_request, { params }) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const rows = await sql`
      UPDATE workout_templates
      SET is_archived = TRUE, updated_at = NOW()
      WHERE id = ${id} AND owner_user_id = ${user.id} AND is_archived = FALSE
      RETURNING id
    `;
    if (!rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/templates/:id failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
