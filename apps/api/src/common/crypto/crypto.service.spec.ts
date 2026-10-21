import { randomBytes } from 'node:crypto';
import { AppConfig } from '../../config/app-config.js';
import type { Env } from '../../config/env.js';
import { CryptoService } from './crypto.service.js';

function service(overrides: Partial<Env> = {}): CryptoService {
  const env = {
    SECRET_KEY: 'x'.repeat(48),
    ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    ENCRYPTION_KEYS_PREVIOUS: [],
    ...overrides,
  } as Env;
  return new CryptoService(new AppConfig(env));
}

describe('CryptoService', () => {
  it('round-trips encrypted values', () => {
    const crypto = service();
    const sealed = crypto.encrypt('token-123');
    expect(sealed).not.toContain('token-123');
    expect(crypto.decrypt(sealed)).toBe('token-123');
  });

  it('rejects tampered ciphertext', () => {
    const crypto = service();
    const sealed = crypto.encrypt('token-123');
    const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA');
    expect(() => crypto.decrypt(tampered)).toThrow();
  });

  it('decrypts values written with a previous key after rotation', () => {
    const oldKey = randomBytes(32).toString('base64');
    const sealed = service({ ENCRYPTION_KEY: oldKey }).encrypt('legacy');
    const rotated = service({ ENCRYPTION_KEYS_PREVIOUS: [oldKey] });
    expect(rotated.decrypt(sealed)).toBe('legacy');
    expect(rotated.needsReencryption(sealed)).toBe(true);
  });

  it('verifies signed tokens only for the purpose they were made for', () => {
    const crypto = service();
    const token = crypto.sign('oauth-state', { workspaceId: 'w1' }, 60);
    expect(crypto.verify('oauth-state', token)).toMatchObject({ workspaceId: 'w1' });
    expect(crypto.verify('mfa-challenge', token)).toBeNull();
  });

  it('rejects expired and forged tokens', () => {
    const crypto = service();
    expect(crypto.verify('postback', crypto.sign('postback', { d: 'x' }, -1))).toBeNull();
    const [body] = crypto.sign('postback', { d: 'x' }, 60).split('.');
    expect(crypto.verify('postback', `${body}.forged`)).toBeNull();
  });
});
