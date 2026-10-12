import { jest } from '@jest/globals';
import {
  mockSql,
  mockGetDbUser,
  resetMocks,
  makeRequest,
} from '../setup.js';

const USER = { id: 10, clerk_user_id: 'u10' };
const params = (obj) => ({ params: Promise.resolve(obj) });

describe('/api/templates collection', () => {
  let GET, POST;
  beforeEach(async () => {
    resetMocks();
    ({ GET, POST } = await import('@/app/api/templates/route.js'));
  });

  it('GET 401 when unauthenticated', async () => {
    mockGetDbUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it('GET lists templates scoped to the user', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([{ id: 't1', name: 'Push A', exercise_count: 3 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockSql.mock.calls[0].slice(1)).toContain(USER.id);
  });

  it('POST 400 when name missing', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    const res = await POST(
      makeRequest('http://localhost/api/templates', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('POST creates owned by the user', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([{ id: 't2', name: 'Pull A' }]);
    const res = await POST(
      makeRequest('http://localhost/api/templates', {
        method: 'POST',
        body: JSON.stringify({ name: '  Pull A  ', owner_user_id: 999 }),
      })
    );
    expect(res.status).toBe(201);
    const vals = mockSql.mock.calls[0].slice(1);
    expect(vals).toContain(USER.id);
    expect(vals).toContain('Pull A');
    expect(vals).not.toContain(999);
  });
});

describe('/api/templates/:id', () => {
  let GET, PATCH, DELETE;
  beforeEach(async () => {
    resetMocks();
    ({ GET, PATCH, DELETE } = await import('@/app/api/templates/[id]/route.js'));
  });

  it('GET returns template + exercises when owned', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql
      .mockResolvedValueOnce([{ id: 't1', name: 'Push A' }]) // template
      .mockResolvedValueOnce([{ id: 'te1', exercise_name: 'Bench' }]); // exercises
    const res = await GET(makeRequest('http://localhost'), params({ id: 't1' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.template.exercises).toHaveLength(1);
  });

  it("GET 404 for another user's template", async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValueOnce([]); // ownership WHERE matched nothing
    const res = await GET(
      makeRequest('http://localhost'),
      params({ id: 'foreign' })
    );
    expect(res.status).toBe(404);
  });

  it('PATCH 400 when name explicitly empty', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    const res = await PATCH(
      makeRequest('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ name: '  ' }),
      }),
      params({ id: 't1' })
    );
    expect(res.status).toBe(400);
  });

  it("PATCH 404 for another user's template", async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([]);
    const res = await PATCH(
      makeRequest('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Hijack' }),
      }),
      params({ id: 'foreign' })
    );
    expect(res.status).toBe(404);
  });

  it("DELETE 404 for another user's template", async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValue([]);
    const res = await DELETE(
      makeRequest('http://localhost'),
      params({ id: 'foreign' })
    );
    expect(res.status).toBe(404);
  });
});

describe('/api/templates/:id/duplicate', () => {
  let POST;
  beforeEach(async () => {
    resetMocks();
    ({ POST } = await import('@/app/api/templates/[id]/duplicate/route.js'));
  });

  it("404 when duplicating another user's template", async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql.mockResolvedValueOnce([]); // source not owned
    const res = await POST(
      makeRequest('http://localhost', { method: 'POST' }),
      params({ id: 'foreign' })
    );
    expect(res.status).toBe(404);
  });

  it('copies the template and names it "(copy)"', async () => {
    mockGetDbUser.mockResolvedValue(USER);
    mockSql
      .mockResolvedValueOnce([{ name: 'Push A' }]) // source
      .mockResolvedValueOnce([{ id: 'new', name: 'Push A (copy)' }]) // insert template
      .mockResolvedValueOnce([]); // copy exercises
    const res = await POST(
      makeRequest('http://localhost', { method: 'POST' }),
      params({ id: 't1' })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.template.name).toBe('Push A (copy)');
  });
});
