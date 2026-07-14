import { describe, it, expect, vi } from 'vitest';
import { createApi } from '../api.js';

function mockFetch(status, body) {
  return vi.fn(async () => ({ ok: status < 400, status, text: async () => JSON.stringify(body) }));
}

describe('createApi', () => {
  it('sends bearer token and parses JSON', async () => {
    const fetcher = mockFetch(200, { ok: true, user: { role: 'admin' } });
    const api = createApi(() => 'tok', fetcher);
    const result = await api.me();
    expect(result.user.role).toBe('admin');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('throws the server error message on failure', async () => {
    const api = createApi(() => 'tok', mockFetch(403, { error: 'No access.' }));
    await expect(api.me()).rejects.toThrow('No access.');
  });

  it('surfaces a non-JSON error body as the message', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }));
    const api = createApi(() => 'tok', fetcher);
    await expect(api.me()).rejects.toThrow('boom');
  });

  it('falls back to a status message when the error body is empty', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 500, text: async () => '' }));
    const api = createApi(() => 'tok', fetcher);
    await expect(api.me()).rejects.toThrow(/500/);
  });
});
