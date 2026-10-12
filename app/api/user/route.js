import { getDbUser } from '@/app/lib/auth';

/**
 * GET /api/user — return the currently authenticated user.
 *
 * Example authenticated route following the project convention:
 *   1. getDbUser() → 401 when null
 *   2. (validate input → 400 on bad input; none needed here)
 *   3. try/catch → log + 500 on failure
 *   4. always respond with Response.json(...)
 */
export async function GET() {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return Response.json({ user });
  } catch (err) {
    console.error('GET /api/user failed:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
