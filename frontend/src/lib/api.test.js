import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiJson, clearAccessToken, setAccessToken } from './api.js';

function tokenFor(subject, issuedAt) {
  const payload = globalThis.btoa(JSON.stringify({ sub: subject, iat: issuedAt }));
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
}

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
});

describe('API refresh handling', () => {
  it('shares one refresh request across simultaneous 401 responses and retries each request once', async () => {
    const oldToken = tokenFor('user-1', 1);
    const nextToken = tokenFor('user-1', 2);
    let refreshCount = 0;
    let rejectedCount = 0;
    let retriedCount = 0;
    const fetchMock = vi.fn(async (input, options = {}) => {
      if (String(input).endsWith('/api/auth/refresh')) {
        refreshCount += 1;
        return Response.json({ accessToken: nextToken, expiresInSeconds: 1800, user: { id: 'user-1' } });
      }
      const authorization = new Headers(options.headers).get('Authorization');
      if (authorization === `Bearer ${oldToken}`) {
        rejectedCount += 1;
        return Response.json({ title: 'Unauthorized' }, { status: 401 });
      }
      retriedCount += 1;
      return Response.json({ id: 'user-1' });
    });
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken(oldToken);

    const results = await Promise.all(Array.from({ length: 5 }, () => apiJson('/api/me')));

    expect(results).toHaveLength(5);
    expect(refreshCount).toBe(1);
    expect(rejectedCount).toBe(5);
    expect(retriedCount).toBe(5);
  });
});
