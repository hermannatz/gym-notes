import { jest } from '@jest/globals';
import {
  mockSql,
  mockGetDbUser,
  resetMocks,
  makeRequest,
} from '../setup.js';

const USER = { id: 5, clerk_user_id: 'u5' };
const params = (obj) => ({ params: Promise.resolve(obj) });

describe('/api/sessions collection', () => {
  let GET, POST;
  beforeEach(async () => {
    resetMocks();
    ({ GET, POST } = await import('@/app/api/sessions/route.js'));
  });

  it('GET 401 when unauthenticated', async () => {
    mockGetDbUser.mockResolvedValue(null);
    const res = await GET(makeRequest('http://localhost/api/sessions'));
    expect(res.status).toBe(401);
  });

  it('GET 400 on invalid status filter', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    const res = await GET(
      makeRequest('http://localhost/api/sessions?status=bogus')
    );
    expect(res.status).toBe(400);
  });

  it('POST creates a blank session (no template)', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql
      .mockResolvedValueOnce(undefined) // insert session (awaited directly)
      .mockResolvedValueOnce([{ id: 'sess1', status: 'in_progress' }]); // select
    const res = await POST(
      makeRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.session.status).toBe('in_progress');
    expect(mockSql.transaction).toBeUndefined();
  });

  it('POST 400 when template_id is not owned', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValueOnce([]); // template ownership check fails
    const res = await POST(
      makeRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ template_id: 'foreign' }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('POST snapshots a template via a transaction', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql
      .mockResolvedValueOnce([{ name: 'Push A' }]) // template owned
      .mockResolvedValueOnce(undefined) // insertSession descriptor
      .mockResolvedValueOnce(undefined) // snapshot descriptor
      .mockResolvedValueOnce([{ id: 'sess2', name: 'Push A' }]); // final select
    mockSql.transaction = jest.fn().mockResolvedValue([]);

    const res = await POST(
      makeRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ template_id: 't1' }),
      })
    );
    expect(res.status).toBe(201);
    expect(mockSql.transaction).toHaveBeenCalledTimes(1);
  });
});

describe('/api/sessions/:id', () => {
  let GET, PATCH, DELETE;
  beforeEach(async () => {
    resetMocks();
    ({ GET, PATCH, DELETE } = await import('@/app/api/sessions/[id]/route.js'));
  });

  it('GET nests sets under their exercise', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql
      .mockResolvedValueOnce([{ id: 'sess1', status: 'in_progress' }]) // session
      .mockResolvedValueOnce([{ id: 'se1', exercise_name: 'Bench' }]) // exercises
      .mockResolvedValueOnce([
        { id: 'ws1', session_exercise_id: 'se1', reps: 5 },
      ]); // sets
    const res = await GET(makeRequest('http://localhost'), params({ id: 'sess1' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.session.exercises[0].sets).toHaveLength(1);
  });

  it("GET 404 for another user's session", async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValueOnce([]);
    const res = await GET(makeRequest('http://localhost'), params({ id: 'x' }));
    expect(res.status).toBe(404);
  });

  it('PATCH finishes a session (sets finished_at)', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([{ id: 'sess1', status: 'completed' }]);
    const res = await PATCH(
      makeRequest('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      }),
      params({ id: 'sess1' })
    );
    expect(res.status).toBe(200);
    expect(mockSql.mock.calls[0].slice(1)).toContain(USER.id);
  });

  it('PATCH 400 on invalid status', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    const res = await PATCH(
      makeRequest('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'bogus' }),
      }),
      params({ id: 'sess1' })
    );
    expect(res.status).toBe(400);
  });

  it("DELETE 404 for another user's session", async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([]);
    const res = await DELETE(makeRequest('http://localhost'), params({ id: 'x' }));
    expect(res.status).toBe(404);
  });
});
