import { getDbUser } from '@/app/lib/auth';
import { sql } from '@/app/lib/db';

/**
 * PUT /api/templates/:id/exercises/order — reorder a template's exercises.
 *
 * Body: { order: [teId, teId, ...] } — the new sequence. Each listed row has
 * its `position` set to its index. All updates are scoped to the user's own
 * template, so foreign rows (or ids from another template) are no-ops.
 */
export async function PUT(request, { params }) {
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

  const order = body?.order;
  if (!Array.isArray(order) || order.some((x) => typeof x !== 'string')) {
    return Response.json(
      { error: 'order must be an array of template-exercise ids' },
      { status: 400 }
    );
  }

  try {
    // Confirm the template belongs to the user before touching any rows.
    const tpl = await sql`
      SELECT id FROM workout_templates
      WHERE id = ${id} AND owner_user_id = ${user.id}
    `;
    if (!tpl[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    if (order.length > 0) {
      // One scoped UPDATE per item, batched in a single transaction. The
      // template_id guard ensures only rows in this (owned) template move.
      await sql.transaction(
        order.map((teId, index) =>
          sql`
            UPDATE template_exercises
            SET position = ${index}, updated_at = NOW()
            WHERE id = ${teId} AND template_id = ${id}
          `
        )
      );
    }

    const exercises = await sql`
      SELECT id, exercise_id, position
      FROM template_exercises
      WHERE template_id = ${id}
      ORDER BY position ASC, created_at ASC
    `;
    return Response.json({ exercises });
  } catch (err) {
    console.error('PUT template exercise order failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
