import { jest } from '@jest/globals';
import {
  mockSql,
  mockGetDbUser,
  resetMocks,
  makeRequest,
} from '../setup.js';

const USER = { id: 42, clerk_user_id: 'user_42' };

describe('/api/exercises collection', () => {
  let GET, POST;

  beforeEach(async () => {
    resetMocks();
    ({ GET, POST } = await import('@/app/api/exercises/route.js'));
  });

  describe('GET', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetDbUser.mockResolvedValue(null);
      const res = await GET();
      expect(res.status).toBe(401);
      expect(mockSql).not.toHaveBeenCalled();
    });

    it('lists exercises scoped to shared + the current user', async () => {
      mockGetDbUser.mockResolvedValue(USER);
      mockSql.mockResolvedValue([
        { id: 'e1', name: 'Bench Press', is_shared: true },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        exercises: [{ id: 'e1', name: 'Bench Press', is_shared: true }],
      });

      // The user's id must be interpolated into the ownership filter.
      const values = mockSql.mock.calls[0].slice(1);
      expect(values).toContain(USER.id);
    });

    it('returns 500 when the query throws', async () => {
      mockGetDbUser.mockResolvedValue(USER);
      mockSql.mockRejectedValue(new Error('db'));
      const res = await GET();
      expect(res.status).toBe(500);
    });
  });

  describe('POST', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetDbUser.mockResolvedValue(null);
      const res = await POST(
        makeRequest('http://localhost/api/exercises', {
          method: 'POST',
          body: JSON.stringify({ name: 'Curl' }),
        })
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when name is missing', async () => {
      mockGetDbUser.mockResolvedValue(USER);
      const res = await POST(
        makeRequest('http://localhost/api/exercises', {
          method: 'POST',
          body: JSON.stringify({ equipment: 'barbell' }),
        })
      );
      expect(res.status).toBe(400);
      expect(mockSql).not.toHaveBeenCalled();
    });

    it('returns 400 on invalid muscle group id', async () => {
      mockGetDbUser.mockResolvedValue(USER);
      const res = await POST(
        makeRequest('http://localhost/api/exercises', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Curl',
            primary_muscle_group_id: 'not-a-number',
          }),
        })
      );
      expect(res.status).toBe(400);
    });

    it('creates a personal exercise owned by the user (not the body)', async () => {
      mockGetDbUser.mockResolvedValue(USER);
      mockSql.mockResolvedValue([
        { id: 'new', owner_user_id: USER.id, name: 'Curl' },
      ]);

      const res = await POST(
        makeRequest('http://localhost/api/exercises', {
          method: 'POST',
          body: JSON.stringify({
            name: '  Curl  ',
            // Attempt to spoof ownership — must be ignored.
            owner_user_id: 9999,
            primary_muscle_group_id: 4,
          }),
        })
      );

      expect(res.status).toBe(201);
      const values = mockSql.mock.calls[0].slice(1);
      // Ownership comes from the authenticated user, never the body.
      expect(values).toContain(USER.id);
      expect(values).not.toContain(9999);
      // Name is trimmed.
      expect(values).toContain('Curl');
    });
  });
});
