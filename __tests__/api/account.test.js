import { jest } from '@jest/globals';
import {
  mockSql,
  mockGetDbUser,
  mockAuth,
  mockDeleteUser,
  resetMocks,
  makeRequest,
} from '../setup.js';

const USER = { id: 3, clerk_user_id: 'user_x' };

describe('DELETE /api/account', () => {
  let DELETE;
  beforeEach(async () => {
    resetMocks();
    ({ DELETE } = await import('@/app/api/account/route.js'));
  });

  it('401 when there is no Clerk session', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const res = await DELETE(makeRequest('http://localhost/api/account', { method: 'DELETE' }));
    expect(res.status).toBe(401);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('deletes local data (by own id) then the Clerk user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_x' });
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([]);
    mockDeleteUser.mockResolvedValue({});

    const res = await DELETE(makeRequest('http://localhost/api/account', { method: 'DELETE' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, clerkDeleted: true });
    // Deleted scoped to the authenticated user's own id.
    expect(mockSql.mock.calls[0].slice(1)).toContain(USER.id);
    // Clerk user removed by clerk id.
    expect(mockDeleteUser).toHaveBeenCalledWith('user_x');
  });

  it('reports partial success when Clerk deletion fails (data already gone)', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_x' });
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([]);
    mockDeleteUser.mockRejectedValue(new Error('clerk down'));

    const res = await DELETE(makeRequest('http://localhost/api/account', { method: 'DELETE' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, clerkDeleted: false });
  });

  it('500 when the local delete throws', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_x' });
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockRejectedValue(new Error('db down'));

    const res = await DELETE(makeRequest('http://localhost/api/account', { method: 'DELETE' }));

    expect(res.status).toBe(500);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
