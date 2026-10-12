import { jest } from '@jest/globals';

/**
 * Tests the REAL getDbUser (not the shared mock). This file registers its own
 * mocks for @/app/lib/db and @clerk/nextjs/server so it can exercise the lazy
 * user-row provisioning logic directly.
 */

const sql = jest.fn();
const auth = jest.fn();
const currentUser = jest.fn();

jest.unstable_mockModule('@/app/lib/db', () => ({ sql }));
jest.unstable_mockModule('@clerk/nextjs/server', () => ({ auth, currentUser }));

describe('getDbUser (lazy provisioning)', () => {
  let getDbUser;

  beforeEach(async () => {
    sql.mockReset();
    auth.mockReset();
    currentUser.mockReset();
    ({ getDbUser } = await import('@/app/lib/auth.js'));
  });

  it('returns null when there is no Clerk session', async () => {
    auth.mockResolvedValue({ userId: null });
    const result = await getDbUser();
    expect(result).toBeNull();
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns the existing row without provisioning', async () => {
    auth.mockResolvedValue({ userId: 'user_1' });
    sql.mockResolvedValueOnce([{ id: 7, clerk_user_id: 'user_1' }]);

    const result = await getDbUser();

    expect(result).toEqual({ id: 7, clerk_user_id: 'user_1' });
    expect(sql).toHaveBeenCalledTimes(1); // only the SELECT
    expect(currentUser).not.toHaveBeenCalled();
  });

  it('provisions a row from Clerk data when none exists', async () => {
    auth.mockResolvedValue({ userId: 'user_new' });
    sql.mockResolvedValueOnce([]); // SELECT finds nothing
    currentUser.mockResolvedValue({
      primaryEmailAddressId: 'e1',
      emailAddresses: [{ id: 'e1', emailAddress: 'new@example.com' }],
      firstName: 'New',
      lastName: 'User',
      username: 'nu',
    });
    sql.mockResolvedValueOnce([
      { id: 8, clerk_user_id: 'user_new', email: 'new@example.com', name: 'New User' },
    ]);

    const result = await getDbUser();

    expect(result).toEqual({
      id: 8,
      clerk_user_id: 'user_new',
      email: 'new@example.com',
      name: 'New User',
    });
    expect(sql).toHaveBeenCalledTimes(2); // SELECT then INSERT
    const insertValues = sql.mock.calls[1].slice(1);
    expect(insertValues).toContain('user_new');
    expect(insertValues).toContain('new@example.com');
    expect(insertValues).toContain('New User');
  });

  it('returns null if Clerk has no user to provision from', async () => {
    auth.mockResolvedValue({ userId: 'ghost' });
    sql.mockResolvedValueOnce([]);
    currentUser.mockResolvedValue(null);

    const result = await getDbUser();
    expect(result).toBeNull();
    expect(sql).toHaveBeenCalledTimes(1); // only the SELECT, no insert
  });
});
