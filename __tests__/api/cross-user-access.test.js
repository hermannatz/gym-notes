import { jest } from '@jest/globals';
import { mockSql, mockGetDbUser, resetMocks, makeRequest } from '../setup.js';

/**
 * Security audit (Req 13.4): every protected resource route must deny access
 * to data the caller does not own. Ownership is enforced in SQL, so a foreign
 * resource matches no row — the handler must return 404 (not 403, no leak).
 *
 * This file exercises the "authenticated but not the owner" path across the
 * resource routes in one place, so the guarantee is auditable at a glance.
 * Each case: a valid user is signed in, but the owned-scoped query returns [].
 */

const USER = { id: 99, clerk_user_id: 'u99' };
const P = (obj) => ({ params: Promise.resolve(obj) });
const req = (method = 'GET', body) =>
  makeRequest('http://localhost', {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

// Each entry: human label, dynamic import path, method, how to invoke.
const cases = [
  ['exercises GET [id]', '@/app/api/exercises/[id]/route.js', 'GET',
    (m, h) => h.GET(req(), P({ id: 'x' }))],
  ['exercises PATCH [id]', '@/app/api/exercises/[id]/route.js', 'PATCH',
    (m, h) => h.PATCH(req('PATCH', { name: 'x' }), P({ id: 'x' }))],
  ['exercises DELETE [id]', '@/app/api/exercises/[id]/route.js', 'DELETE',
    (m, h) => h.DELETE(req('DELETE'), P({ id: 'x' }))],

  ['template GET [id]', '@/app/api/templates/[id]/route.js', 'GET',
    (m, h) => h.GET(req(), P({ id: 'x' }))],
  ['template PATCH [id]', '@/app/api/templates/[id]/route.js', 'PATCH',
    (m, h) => h.PATCH(req('PATCH', { name: 'x' }), P({ id: 'x' }))],
  ['template DELETE [id]', '@/app/api/templates/[id]/route.js', 'DELETE',
    (m, h) => h.DELETE(req('DELETE'), P({ id: 'x' }))],
  ['template duplicate', '@/app/api/templates/[id]/duplicate/route.js', 'POST',
    (m, h) => h.POST(req('POST'), P({ id: 'x' }))],
  ['template-exercise PATCH', '@/app/api/templates/[id]/exercises/[teId]/route.js', 'PATCH',
    (m, h) => h.PATCH(req('PATCH', { target_sets: 3 }), P({ id: 'x', teId: 'y' }))],
  ['template-exercise DELETE', '@/app/api/templates/[id]/exercises/[teId]/route.js', 'DELETE',
    (m, h) => h.DELETE(req('DELETE'), P({ id: 'x', teId: 'y' }))],

  ['session GET [id]', '@/app/api/sessions/[id]/route.js', 'GET',
    (m, h) => h.GET(req(), P({ id: 'x' }))],
  ['session PATCH [id]', '@/app/api/sessions/[id]/route.js', 'PATCH',
    (m, h) => h.PATCH(req('PATCH', { status: 'completed' }), P({ id: 'x' }))],
  ['session DELETE [id]', '@/app/api/sessions/[id]/route.js', 'DELETE',
    (m, h) => h.DELETE(req('DELETE'), P({ id: 'x' }))],
  ['session-exercise PATCH', '@/app/api/sessions/[id]/exercises/[seId]/route.js', 'PATCH',
    (m, h) => h.PATCH(req('PATCH', { skipped: true }), P({ id: 'x', seId: 'y' }))],
  ['session-exercise DELETE', '@/app/api/sessions/[id]/exercises/[seId]/route.js', 'DELETE',
    (m, h) => h.DELETE(req('DELETE'), P({ id: 'x', seId: 'y' }))],
  ['previous performance', '@/app/api/sessions/[id]/exercises/[seId]/previous/route.js', 'GET',
    (m, h) => h.GET(req(), P({ id: 'x', seId: 'y' }))],
  ['set PATCH', '@/app/api/sessions/[id]/exercises/[seId]/sets/[setId]/route.js', 'PATCH',
    (m, h) => h.PATCH(req('PATCH', { completed: true }), P({ id: 'x', seId: 'y', setId: 'z' }))],
  ['set DELETE', '@/app/api/sessions/[id]/exercises/[seId]/sets/[setId]/route.js', 'DELETE',
    (m, h) => h.DELETE(req('DELETE'), P({ id: 'x', seId: 'y', setId: 'z' }))],
  ['analytics exercise', '@/app/api/analytics/exercise/[exerciseId]/route.js', 'GET',
    (m, h) => h.GET(req(), P({ exerciseId: 'x' }))],
];

describe('cross-user access denial (Req 13.4)', () => {
  for (const [label, path, , invoke] of cases) {
    it(`${label} → 404 for a resource the user does not own`, async () => {
      resetMocks();
      mockGetDbUser.mockResolvedValue(USER);
      // Every ownership-scoped query finds nothing for a foreign resource.
      mockSql.mockResolvedValue([]);

      const handler = await import(path);
      const res = await invoke(null, handler);

      expect(res.status).toBe(404);
    });
  }

  it('every denial is 404, never 403 (no existence leak)', async () => {
    resetMocks();
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([]);
    const handler = await import('@/app/api/sessions/[id]/route.js');
    const res = await handler.GET(req(), P({ id: 'x' }));
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(404);
  });
});
