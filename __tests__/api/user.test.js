import { jest } from '@jest/globals';
import {
  mockGetDbUser,
  resetMocks,
  makeRequest,
} from '../setup.js';

describe('GET /api/user', () => {
  let GET;

  beforeEach(async () => {
    resetMocks();
    // Import the handler AFTER mocks are registered and reset.
    ({ GET } = await import('@/app/api/user/route.js'));
  });

  it('returns 401 when there is no authenticated user', async () => {
    mockGetDbUser.mockResolvedValue(null);

    const res = await GET(makeRequest('http://localhost/api/user'));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mockGetDbUser).toHaveBeenCalledTimes(1);
  });

  it('returns the current user when authenticated', async () => {
    const user = {
      id: 1,
      clerk_user_id: 'user_123',
      email: 'tester@example.com',
      name: 'Tester',
    };
    mockGetDbUser.mockResolvedValue(user);

    const res = await GET(makeRequest('http://localhost/api/user'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ user });
  });
});
