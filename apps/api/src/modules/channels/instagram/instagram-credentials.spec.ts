import { AppConfig } from '../../../config/app-config.js';
import type { Env } from '../../../config/env.js';
import type { InstanceSettingsService } from '../../instance/instance-settings.service.js';
import { classifyCredentialsProbe, InstagramProvider } from './instagram.provider.js';
import { InstagramGraphClient } from './instagram-graph.client.js';

const APP = {
  appId: '1234567890',
  appSecret: 'abcdef0123456789abcdef0123456789',
  verifyToken: 't',
};
const REDIRECT = 'https://conversa.example.com/api/v1/channels/oauth/instagram/callback';

function provider(app: typeof APP | null) {
  const graph = new InstagramGraphClient(new AppConfig({ META_GRAPH_VERSION: 'v24.0' } as Env));
  return new InstagramProvider(graph, { instagram: app } as unknown as InstanceSettingsService);
}

/** Meta's token endpoint, answering every exchange with the given error. */
function metaAnswers(status: number, body: unknown) {
  const calls: Array<{ url: string; body: string }> = [];
  global.fetch = (async (url: URL | string, init?: RequestInit) => {
    calls.push({ url: String(url), body: typeof init?.body === 'string' ? init.body : '' });
    return { ok: status < 400, status, json: async () => body } as Response;
  }) as typeof fetch;
  return calls;
}

describe('classifyCredentialsProbe', () => {
  it('reads a complaint about the code as credentials that passed', () => {
    expect(classifyCredentialsProbe('Invalid authorization code')).toBe('valid');
    expect(
      classifyCredentialsProbe(
        'Error validating verification code. Please make sure your redirect_uri is identical',
      ),
    ).toBe('valid');
    expect(classifyCredentialsProbe('This authorization code has been used')).toBe('valid');
  });

  it('reads a complaint about the app or the secret as credentials that failed', () => {
    expect(classifyCredentialsProbe('Invalid platform app')).toBe('invalid');
    expect(classifyCredentialsProbe('Error validating client secret.')).toBe('invalid');
    expect(classifyCredentialsProbe('Invalid client_id')).toBe('invalid');
  });

  it('does not guess at anything else', () => {
    expect(classifyCredentialsProbe('Please try again later')).toBe('unknown');
    expect(classifyCredentialsProbe('HTTP 500 (code -/-, trace -)')).toBe('unknown');
  });
});

describe('InstagramProvider.checkAppCredentials', () => {
  it('reports a missing app without calling Meta', async () => {
    const calls = metaAnswers(400, {});
    await expect(provider(null).checkAppCredentials(REDIRECT)).resolves.toBe('not_configured');
    expect(calls).toHaveLength(0);
  });

  it('exchanges a code that cannot work and reads why Meta refused it', async () => {
    const calls = metaAnswers(400, {
      error_type: 'OAuthException',
      code: 400,
      error_message: 'Invalid authorization code',
    });
    await expect(provider(APP).checkAppCredentials(REDIRECT)).resolves.toBe('valid');
    expect(calls[0]?.url).toBe('https://api.instagram.com/oauth/access_token');
    expect(new URLSearchParams(calls[0]?.body).get('client_id')).toBe(APP.appId);

    metaAnswers(400, {
      error_type: 'OAuthException',
      code: 400,
      error_message: 'Invalid platform app',
    });
    await expect(provider(APP).checkAppCredentials(REDIRECT)).resolves.toBe('invalid');
  });

  it('answers unknown when Meta cannot be reached, and never throws', async () => {
    global.fetch = (async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }) as typeof fetch;
    await expect(provider(APP).checkAppCredentials(REDIRECT)).resolves.toBe('unknown');
    metaAnswers(503, {});
    await expect(provider(APP).checkAppCredentials(REDIRECT)).resolves.toBe('unknown');
  });
});
