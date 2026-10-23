import { ProviderError } from '../provider/channel-provider.js';
import { classifyTikTokError, TikTokApiClient } from './tiktok-api.client.js';
import { parseJsonKeepingIds } from './tiktok-json.js';

function answers(status: number, body: string) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  global.fetch = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return { ok: status < 400, status, text: async () => body } as Response;
  }) as typeof fetch;
  return calls;
}

describe('classifyTikTokError', () => {
  it('maps token problems to auth', () => {
    for (const code of [40102, 40103, 40104, 40105, 40107, 40131])
      expect(classifyTikTokError(code, 200)).toBe('auth');
  });

  it('maps throttling to rate_limit', () => {
    expect(classifyTikTokError(40100, 200)).toBe('rate_limit');
    expect(classifyTikTokError(40016, 200)).toBe('rate_limit');
    expect(classifyTikTokError(undefined, 429)).toBe('rate_limit');
  });

  it('maps a message blocked by the direct message rules to window_closed', () => {
    expect(classifyTikTokError(40064, 200)).toBe('window_closed');
  });

  it('maps system errors to transient and the rest to rejected', () => {
    expect(classifyTikTokError(51065, 200)).toBe('transient');
    expect(classifyTikTokError(50002, 200)).toBe('transient');
    expect(classifyTikTokError(undefined, 503)).toBe('transient');
    expect(classifyTikTokError(40001, 200)).toBe('rejected');
    expect(classifyTikTokError(40002, 200)).toBe('rejected');
  });
});

describe('TikTokApiClient', () => {
  const client = new TikTokApiClient();

  it('sends the token in the Access-Token header and JSON-encodes list parameters', async () => {
    const calls = answers(200, '{"code":0,"message":"OK","data":{"videos":[]}}');
    await client.request({
      path: '/business/video/list/',
      accessToken: 'secret-token',
      query: { business_id: 'b1', fields: ['item_id'], filters: { video_ids: ['1'] } },
    });
    const url = new URL(calls[0]!.url);
    const headers = (calls[0]!.init?.headers ?? {}) as Record<string, string>;
    expect(headers['Access-Token']).toBe('secret-token');
    expect(calls[0]!.url).not.toContain('secret-token');
    expect(url.searchParams.get('fields')).toBe('["item_id"]');
    expect(url.searchParams.get('filters')).toBe('{"video_ids":["1"]}');
  });

  it('returns data, keeping long numeric ids exact', async () => {
    answers(200, '{"code":0,"data":{"id":7247303576418566913,"n":5}}');
    await expect(client.request({ path: '/x/' })).resolves.toEqual({
      id: '7247303576418566913',
      n: 5,
    });
  });

  it('treats a non-zero code in an HTTP 200 answer as a failure, naming the path but not the token', async () => {
    answers(200, '{"code":40105,"message":"Invalid access token","request_id":"r1"}');
    const error = await client
      .request({ path: '/business/get/', accessToken: 'secret-token' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).kind).toBe('auth');
    expect((error as ProviderError).providerCode).toBe('40105');
    expect((error as ProviderError).message).toContain('/business/get/');
    expect((error as ProviderError).message).not.toContain('secret-token');
  });

  it('treats an unreadable answer as transient', async () => {
    answers(200, '<html>bad gateway</html>');
    const error = await client.request({ path: '/x/' }).catch((e: unknown) => e);
    expect((error as ProviderError).kind).toBe('transient');
  });

  it('treats a network failure as transient', async () => {
    global.fetch = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;
    const error = await client.request({ path: '/x/' }).catch((e: unknown) => e);
    expect((error as ProviderError).kind).toBe('transient');
  });
});

describe('parseJsonKeepingIds', () => {
  it('reads long integers as strings and leaves the rest alone', () => {
    expect(
      parseJsonKeepingIds(
        '{"comment_id":7247303576418566913,"n":-12,"f":1.5e3,"small":123456789012345,"arr":[7203946942097902849]}',
      ),
    ).toEqual({
      comment_id: '7247303576418566913',
      n: -12,
      f: 1500,
      small: 123456789012345,
      arr: ['7203946942097902849'],
    });
  });

  it('never touches numbers inside strings', () => {
    expect(
      parseJsonKeepingIds('{"text":"order:12345678901234567890, \\"quoted\\" 99999999999999999"}'),
    ).toEqual({ text: 'order:12345678901234567890, "quoted" 99999999999999999' });
  });
});
