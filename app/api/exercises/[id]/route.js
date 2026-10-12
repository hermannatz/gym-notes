import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * GET /api/exercises/:id — fetch a single exercise the user may see
 * (a shared exercise or one they own). Returns 404 for anything else so the
 * existence of other users' personal exercises is never leaked.
 */
export async function GET(_request, { params }) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const rows = await sql`
      SELECT
        e.id, e.owner_user_id, e.name, e.primary_muscle_group_id,
        mg.name AS primary_muscle_group, e.equipment, e.movement_category,
        e.description, (e.owner_user_id IS NULL) AS is_shared
      FROM exercises e
      LEFT JOIN muscle_groups mg ON mg.id = e.primary_muscle_group_id
      WHERE e.id = ${id}
        AND e.is_archived = FALSE
        AND (e.owner_user_id IS NULL OR e.owner_user_id = ${user.id})
    `;

    if (!rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ exercise: rows[0] });
  } catch (err) {
    console.error('GET /api/exercises/:id failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/exercises/:id — update a personal exercise owned by the user.
 * Shared exercises and other users' exercises are not editable and return 404.
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

  // Build the updates. name, if present, must be non-empty.
  let name;
  if (body.name !== undefined) {
    name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return Response.json(
        { error: 'name cannot be empty' },
        { status: 400 }
      );
    }
  }

  let primaryMuscleGroupId;
  if (body.primary_muscle_group_id !== undefined) {
    primaryMuscleGroupId =
      body.primary_muscle_group_id === null
        ? null
        : Number(body.primary_muscle_group_id);
    if (
      primaryMuscleGroupId !== null &&
      !Number.isInteger(primaryMuscleGroupId)
    ) {
      return Response.json(
        { error: 'primary_muscle_group_id must be an integer' },
        { status: 400 }
      );
    }
  }

  try {
    // COALESCE keeps existing values when a field is omitted. Ownership is
    // enforced in the WHERE clause: only the user's own, non-shared row.
    const rows = await sql`
      UPDATE exercises
      SET
        name = COALESCE(${name ?? null}, name),
        primary_muscle_group_id = CASE
          WHEN ${body.primary_muscle_group_id !== undefined}
          THEN ${primaryMuscleGroupId ?? null}
          ELSE primary_muscle_group_id
        END,
        equipment = CASE
          WHEN ${body.equipment !== undefined}
          THEN ${body.equipment ?? null}
          ELSE equipment
        END,
        movement_category = CASE
          WHEN ${body.movement_category !== undefined}
          THEN ${body.movement_category ?? null}
          ELSE movement_category
        END,
        description = CASE
          WHEN ${body.description !== undefined}
          THEN ${body.description ?? null}
          ELSE description
        END,
        updated_at = NOW()
      WHERE id = ${id}
        AND owner_user_id = ${user.id}
        AND is_archived = FALSE
      RETURNING id, owner_user_id, name, primary_muscle_group_id,
        equipment, movement_category, description
    `;

    if (!rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ exercise: rows[0] });
  } catch (err) {
    console.error('PATCH /api/exercises/:id failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/exercises/:id — archive a personal exercise owned by the user.
 * Soft-delete (is_archived = TRUE) so historical sessions/templates that
 * reference the exercise remain intact. Returns 404 for shared or other
 * users' exercises.
 */
export async function DELETE(_request, { params }) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const rows = await sql`
      UPDATE exercises
      SET is_archived = TRUE, updated_at = NOW()
      WHERE id = ${id}
        AND owner_user_id = ${user.id}
        AND is_archived = FALSE
      RETURNING id
    `;

    if (!rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/exercises/:id failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
