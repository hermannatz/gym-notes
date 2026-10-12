import { jest } from '@jest/globals';
import {
  mockSql,
  mockGetDbUser,
  resetMocks,
  makeRequest,
} from '../setup.js';

const USER = { id: 42, clerk_user_id: 'user_42' };

describe('/api/exercises/:id', () => {
  let GET, PATCH, DELETE;

  beforeEach(async () => {
    resetMocks();
    ({ GET, PATCH, DELETE } = await import(
      '@/app/api/exercises/[id]/route.js'
    ));
  });

  const params = (id) => ({ params: Promise.resolve({ id }) });

  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetDbUser.mockResolvedValue(null);
      const res = await GET(makeRequest('http://localhost'), params('e1'));
      expect(res.status).toBe(401);
    });

    it('returns the exercise when visible', async () => {
      mockGetDbUser.mockResolvedValue(USER);
      mockSql.mockResolvedValue([{ id: 'e1', name: 'Bench', is_shared: true }]);
      const res = await GET(makeRequest('http://localhost'), params('e1'));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        exercise: { id: 'e1', name: 'Bench', is_shared: true },
      });
    });

    it("returns 404 for another user's exercise (not 403, no leak)", async () => {
      mockGetDbUser.mockResolvedValue(USER);
      // Ownership filter in SQL yields no row for a foreign exercise.
      mockSql.mockResolvedValue([]);
      const res = await GET(makeRequest('http://localhost'), params('foreign'));
      expect(res.status).toBe(404);
      // The query must scope by the authenticated user's id.
      const values = mockSql.mock.calls[0].slice(1);
      expect(values).toContain(USER.id);
    });
  });

  describe('PATCH', () => {
    it('returns 400 when name is explicitly empty', async () => {
      mockGetDbUser.mockResolvedValue(USER);
      const res = await PATCH(
        makeRequest('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ name: '   ' }),
        }),
        params('e1')
      );
      expect(res.status).toBe(400);
      expect(mockSql).not.toHaveBeenCalled();
    });

    it('updates the user-owned exercise', async () => {
      mockGetDbUser.mockResolvedValue(USER);
      mockSql.mockResolvedValue([{ id: 'e1', name: 'Updated' }]);
      const res = await PATCH(
        makeRequest('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated' }),
        }),
        params('e1')
      );
      expect(res.status).toBe(200);
      const values = mockSql.mock.calls[0].slice(1);
      expect(values).toContain(USER.id);
    });

    it("returns 404 when patching another user's exercise", async () => {
      mockGetDbUser.mockResolvedValue(USER);
      mockSql.mockResolvedValue([]); // ownership WHERE matched nothing
      const res = await PATCH(
        makeRequest('http://localhost', {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Hijack' }),
        }),
        params('foreign')
      );
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE', () => {
    it('archives the user-owned exercise', async () => {
      mockGetDbUser.mockResolvedValue(USER);
      mockSql.mockResolvedValue([{ id: 'e1' }]);
      const res = await DELETE(makeRequest('http://localhost'), params('e1'));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ ok: true });
      const values = mockSql.mock.calls[0].slice(1);
      expect(values).toContain(USER.id);
    });

    it("returns 404 when deleting another user's exercise", async () => {
      mockGetDbUser.mockResolvedValue(USER);
      mockSql.mockResolvedValue([]);
      const res = await DELETE(
        makeRequest('http://localhost'),
        params('foreign')
      );
      expect(res.status).toBe(404);
    });
  });
});
