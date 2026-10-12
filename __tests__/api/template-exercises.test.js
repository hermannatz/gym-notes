import { jest } from '@jest/globals';
import {
  mockSql,
  mockGetDbUser,
  resetMocks,
  makeRequest,
} from '../setup.js';

const USER = { id: 10, clerk_user_id: 'u10' };
const params = (obj) => ({ params: Promise.resolve(obj) });

describe('POST /api/templates/:id/exercises', () => {
  let POST;
  beforeEach(async () => {
    resetMocks();
    ({ POST } = await import('@/app/api/templates/[id]/exercises/route.js'));
  });

  const req = (bodyObj) =>
    makeRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify(bodyObj),
    });

  it('400 when exercise_id missing', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    const res = await POST(req({}), params({ id: 't1' }));
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("404 when the template isn't owned by the user", async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValueOnce([]); // template ownership check fails
    const res = await POST(req({ exercise_id: 'e1' }), params({ id: 'foreign' }));
    expect(res.status).toBe(404);
  });

  it('400 when the exercise is not visible to the user', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql
      .mockResolvedValueOnce([{ id: 't1' }]) // template owned
      .mockResolvedValueOnce([]); // exercise not visible
    const res = await POST(
      req({ exercise_id: 'foreign-exercise' }),
      params({ id: 't1' })
    );
    expect(res.status).toBe(400);
  });

  it('400 on invalid target_sets', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    const res = await POST(
      req({ exercise_id: 'e1', target_sets: -2 }),
      params({ id: 't1' })
    );
    expect(res.status).toBe(400);
  });

  it('adds the exercise, defaulting position to end', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql
      .mockResolvedValueOnce([{ id: 't1' }]) // template owned
      .mockResolvedValueOnce([{ id: 'e1' }]) // exercise visible
      .mockResolvedValueOnce([{ next: 2 }]) // max position + 1
      .mockResolvedValueOnce([{ id: 'te1', exercise_id: 'e1', position: 2 }]); // insert
    const res = await POST(req({ exercise_id: 'e1' }), params({ id: 't1' }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.templateExercise.position).toBe(2);
  });
});

describe('PATCH/DELETE /api/templates/:id/exercises/:teId', () => {
  let PATCH, DELETE;
  beforeEach(async () => {
    resetMocks();
    ({ PATCH, DELETE } = await import(
      '@/app/api/templates/[id]/exercises/[teId]/route.js'
    ));
  });

  it('PATCH 404 when row not in the user-owned template', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([]); // scoped UPDATE matched nothing
    const res = await PATCH(
      makeRequest('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ target_sets: 4 }),
      }),
      params({ id: 't1', teId: 'teX' })
    );
    expect(res.status).toBe(404);
  });

  it('PATCH updates targets for an owned row', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([{ id: 'te1', target_sets: 4 }]);
    const res = await PATCH(
      makeRequest('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ target_sets: 4 }),
      }),
      params({ id: 't1', teId: 'te1' })
    );
    expect(res.status).toBe(200);
    expect(mockSql.mock.calls[0].slice(1)).toContain(USER.id);
  });

  it('DELETE 404 when row not owned', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([]);
    const res = await DELETE(
      makeRequest('http://localhost'),
      params({ id: 't1', teId: 'teX' })
    );
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/templates/:id/exercises/order', () => {
  let PUT;
  beforeEach(async () => {
    resetMocks();
    ({ PUT } = await import(
      '@/app/api/templates/[id]/exercises/order/route.js'
    ));
  });

  const req = (bodyObj) =>
    makeRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify(bodyObj),
    });

  it('400 when order is not an array of strings', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    const res = await PUT(req({ order: [1, 2] }), params({ id: 't1' }));
    expect(res.status).toBe(400);
  });

  it("404 when the template isn't owned", async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValueOnce([]); // ownership check fails
    const res = await PUT(
      req({ order: ['a', 'b'] }),
      params({ id: 'foreign' })
    );
    expect(res.status).toBe(404);
  });

  it('reorders via a transaction and returns the new order', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    // Call sequence of mockSql in the route:
    //   1) ownership check
    //   2,3) building each UPDATE query inside order.map (results unused)
    //   4) final SELECT returning the new order
    mockSql
      .mockResolvedValueOnce([{ id: 't1' }]) // ownership
      .mockResolvedValueOnce([]) // map build for 'b'
      .mockResolvedValueOnce([]) // map build for 'a'
      .mockResolvedValueOnce([
        { id: 'b', position: 0 },
        { id: 'a', position: 1 },
      ]); // final select
    mockSql.transaction = jest.fn().mockResolvedValue([]);

    const res = await PUT(req({ order: ['b', 'a'] }), params({ id: 't1' }));
    expect(res.status).toBe(200);
    expect(mockSql.transaction).toHaveBeenCalledTimes(1);
    const data = await res.json();
    expect(data.exercises[0].id).toBe('b');
  });
});
