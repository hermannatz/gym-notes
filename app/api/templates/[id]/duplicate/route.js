import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * POST /api/templates/:id/duplicate — copy a template owned by the user,
 * including all of its template_exercises (new ids, preserved order and
 * targets). The copy is named "<name> (copy)".
 */
export async function POST(_request, { params }) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership and read the source name.
    const sourceRows = await sql`
      SELECT name FROM workout_templates
      WHERE id = ${id} AND owner_user_id = ${user.id}
    `;
    if (!sourceRows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // Create the new template.
    const newName = `${sourceRows[0].name} (copy)`;
    const newRows = await sql`
      INSERT INTO workout_templates (owner_user_id, name)
      VALUES (${user.id}, ${newName})
      RETURNING id, name, is_archived, created_at, updated_at
    `;
    const newTemplate = newRows[0];

    // Copy the exercises server-side. The subquery is re-scoped to the owned
    // source template so a user can only ever copy their own rows.
    await sql`
      INSERT INTO template_exercises
        (template_id, exercise_id, position, target_sets, target_rep_min,
         target_rep_max, target_weight, rest_seconds)
      SELECT
        ${newTemplate.id}, te.exercise_id, te.position, te.target_sets,
        te.target_rep_min, te.target_rep_max, te.target_weight, te.rest_seconds
      FROM template_exercises te
      JOIN workout_templates t ON t.id = te.template_id
      WHERE te.template_id = ${id} AND t.owner_user_id = ${user.id}
    `;

    return Response.json({ template: newTemplate }, { status: 201 });
  } catch (err) {
    console.error('POST /api/templates/:id/duplicate failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
