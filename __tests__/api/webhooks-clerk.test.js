import { jest } from '@jest/globals';
import {
  mockSql,
  mockVerifyWebhook,
  resetMocks,
  makeRequest,
} from '../setup.js';

describe('POST /api/webhooks/clerk', () => {
  let POST;

  beforeEach(async () => {
    resetMocks();
    ({ POST } = await import('@/app/api/webhooks/clerk/route.js'));
  });

  it('returns 400 when signature verification fails', async () => {
    mockVerifyWebhook.mockRejectedValue(new Error('bad signature'));

    const res = await POST(makeRequest('http://localhost/api/webhooks/clerk'));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid signature' });
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('upserts the user on user.created and picks the primary email', async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: 'user.created',
      data: {
        id: 'user_abc',
        primary_email_address_id: 'idA',
        email_addresses: [
          { id: 'idB', email_address: 'secondary@example.com' },
          { id: 'idA', email_address: 'primary@example.com' },
        ],
        first_name: 'Jane',
        last_name: 'Doe',
        username: 'jd',
      },
    });
    mockSql.mockResolvedValue([]);

    const res = await POST(makeRequest('http://localhost/api/webhooks/clerk'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    // Tagged-template call: args are (strings, ...values).
    const [, clerkId, email, name] = mockSql.mock.calls[0];
    expect(clerkId).toBe('user_abc');
    expect(email).toBe('primary@example.com');
    expect(name).toBe('Jane Doe');
  });

  it('deletes the user on user.deleted', async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: 'user.deleted',
      data: { id: 'user_gone' },
    });
    mockSql.mockResolvedValue([]);

    const res = await POST(makeRequest('http://localhost/api/webhooks/clerk'));

    expect(res.status).toBe(200);
    const [, clerkId] = mockSql.mock.calls[0];
    expect(clerkId).toBe('user_gone');
  });

  it('acknowledges unhandled event types without touching the db', async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: 'session.created',
      data: { id: 'sess_1' },
    });

    const res = await POST(makeRequest('http://localhost/api/webhooks/clerk'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      ignored: 'session.created',
    });
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('returns 500 when the db write throws', async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: 'user.created',
      data: {
        id: 'user_err',
        primary_email_address_id: 'idA',
        email_addresses: [{ id: 'idA', email_address: 'e@example.com' }],
        first_name: null,
        last_name: null,
        username: null,
      },
    });
    mockSql.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest('http://localhost/api/webhooks/clerk'));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'Internal server error',
    });
  });
});
