import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * GET /api/exercises — list exercises visible to the current user:
 * all shared exercises (owner_user_id IS NULL) plus the user's own personal
 * exercises. Archived exercises are excluded by default.
 */
export async function GET() {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const exercises = await sql`
      SELECT
        e.id,
        e.owner_user_id,
        e.name,
        e.primary_muscle_group_id,
        mg.name AS primary_muscle_group,
        e.equipment,
        e.movement_category,
        e.description,
        (e.owner_user_id IS NULL) AS is_shared
      FROM exercises e
      LEFT JOIN muscle_groups mg ON mg.id = e.primary_muscle_group_id
      WHERE e.is_archived = FALSE
        AND (e.owner_user_id IS NULL OR e.owner_user_id = ${user.id})
      ORDER BY e.name ASC
    `;
    return Response.json({ exercises });
  } catch (err) {
    console.error('GET /api/exercises failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/exercises — create a personal exercise owned by the current user.
 * Ownership is always derived from the authenticated user, never the body.
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
    return Response.json(
      { error: 'name is required' },
      { status: 400 }
    );
  }

  const primaryMuscleGroupId =
    body.primary_muscle_group_id === undefined ||
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

  const equipment =
    typeof body.equipment === 'string' ? body.equipment.trim() || null : null;
  const movementCategory =
    typeof body.movement_category === 'string'
      ? body.movement_category.trim() || null
      : null;
  const description =
    typeof body.description === 'string'
      ? body.description.trim() || null
      : null;

  try {
    const rows = await sql`
      INSERT INTO exercises
        (owner_user_id, name, primary_muscle_group_id, equipment,
         movement_category, description)
      VALUES
        (${user.id}, ${name}, ${primaryMuscleGroupId}, ${equipment},
         ${movementCategory}, ${description})
      RETURNING id, owner_user_id, name, primary_muscle_group_id,
        equipment, movement_category, description
    `;
    return Response.json({ exercise: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('POST /api/exercises failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
