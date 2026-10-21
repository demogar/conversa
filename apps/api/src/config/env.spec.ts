import { randomBytes } from 'node:crypto';
import { loadEnv } from './env.js';

function source(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    APP_URL: 'http://localhost:3000/',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/conversa',
    REDIS_URL: 'redis://localhost:6379',
    SECRET_KEY: 'x'.repeat(48),
    ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    ...overrides,
  };
}

describe('loadEnv', () => {
  it('parses a minimal configuration with defaults', () => {
    const env = loadEnv(source());
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      APP_URL: 'http://localhost:3000',
      API_PORT: 4000,
      TRUST_PROXY: 'none',
      INSTAGRAM_SANDBOX: false,
      WORKER_IN_API: false,
      ENCRYPTION_KEYS_PREVIOUS: [],
    });
  });

  it('rejects a missing SECRET_KEY', () => {
    expect(() => loadEnv(source({ SECRET_KEY: undefined }))).toThrow(/SECRET_KEY/);
  });

  it('rejects a SECRET_KEY that is too short', () => {
    expect(() => loadEnv(source({ SECRET_KEY: 'short' }))).toThrow(
      /SECRET_KEY: must be at least 32 characters/,
    );
  });

  it('rejects an ENCRYPTION_KEY that is not 32 bytes', () => {
    expect(() => loadEnv(source({ ENCRYPTION_KEY: randomBytes(16).toString('base64') }))).toThrow(
      /ENCRYPTION_KEY: must be 32 bytes/,
    );
    expect(() =>
      loadEnv(source({ ENCRYPTION_KEYS_PREVIOUS: `${randomBytes(32).toString('base64')},abc` })),
    ).toThrow(/ENCRYPTION_KEYS_PREVIOUS/);
  });

  it('lists every problem at once', () => {
    expect(() => loadEnv(source({ SECRET_KEY: undefined, APP_URL: 'not a url' }))).toThrow(
      /APP_URL[\s\S]*SECRET_KEY|SECRET_KEY[\s\S]*APP_URL/,
    );
  });

  it('refuses the Instagram sandbox in production', () => {
    expect(() => loadEnv(source({ INSTAGRAM_SANDBOX: 'true', NODE_ENV: 'production' }))).toThrow(
      /INSTAGRAM_SANDBOX/,
    );
    expect(loadEnv(source({ INSTAGRAM_SANDBOX: 'true', NODE_ENV: 'test' })).INSTAGRAM_SANDBOX).toBe(
      true,
    );
  });

  it('accepts a proxy hop count and rejects anything else', () => {
    expect(loadEnv(source({ TRUST_PROXY: '2' })).TRUST_PROXY).toBe(2);
    expect(() => loadEnv(source({ TRUST_PROXY: 'everyone' }))).toThrow(/TRUST_PROXY/);
  });
});
