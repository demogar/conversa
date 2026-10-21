import { AppConfig } from '../../../config/app-config.js';
import type { Env } from '../../../config/env.js';
import { readShortLivedToken } from './instagram.provider.js';
import { InstagramGraphClient } from './instagram-graph.client.js';

describe('InstagramGraphClient', () => {
  const client = new InstagramGraphClient(new AppConfig({ META_GRAPH_VERSION: 'v24.0' } as Env));
  let calls: Array<{ url: string; headers: Record<string, string> }>;

  beforeEach(() => {
    calls = [];
    global.fetch = (async (url: URL | string, init?: RequestInit) => {
      calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
      return { ok: true, status: 200, json: async () => ({ access_token: 'long' }) } as Response;
    }) as typeof fetch;
  });

  it('sends the token in the Authorization header by default', async () => {
    await client.request({ path: '/me', accessToken: 'secret-token' });
    expect(calls[0]?.headers.Authorization).toBe('Bearer secret-token');
    expect(calls[0]?.url).not.toContain('secret-token');
  });

  it('sends the token as a query parameter to endpoints that require it', async () => {
    await client.request({ path: '/access_token', accessToken: 'short', tokenIn: 'query' });
    expect(new URL(calls[0]!.url).searchParams.get('access_token')).toBe('short');
    expect(calls[0]?.headers.Authorization).toBeUndefined();
  });
});

describe('readShortLivedToken', () => {
  it('reads the flat and the wrapped answers', () => {
    expect(readShortLivedToken({ access_token: 'a' })).toBe('a');
    expect(readShortLivedToken({ data: [{ access_token: 'b' }] })).toBe('b');
    expect(readShortLivedToken({})).toBeNull();
  });
});
