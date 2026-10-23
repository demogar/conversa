import { randomBytes } from 'node:crypto';
import { AppConfig } from '../../config/app-config.js';
import type { Env } from '../../config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PostbackTokens } from './postback-token.js';

const DELIVERY = 'cm2abcdefghijklmnopqrstuv';

const tokens = new PostbackTokens(
  new CryptoService(
    new AppConfig({
      SECRET_KEY: 'x'.repeat(48),
      ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      ENCRYPTION_KEYS_PREVIOUS: [],
    } as unknown as Env),
  ),
);

describe('PostbackTokens', () => {
  it('reads back the tokens it creates', () => {
    const token = tokens.create(DELIVERY);
    expect(token.startsWith('cv1.')).toBe(true);
    expect(tokens.read(token)).toBe(DELIVERY);
  });

  it('fits a 40-character button id with a shorter signature', () => {
    const token = tokens.create(DELIVERY, 40);
    expect(token.length).toBeLessThanOrEqual(40);
    expect(token.startsWith('c1.')).toBe(true);
    expect(tokens.read(token)).toBe(DELIVERY);
  });

  it('refuses forged, altered or mixed-up tokens', () => {
    const full = tokens.create(DELIVERY);
    const compact = tokens.create(DELIVERY, 40);
    const [, , signature] = full.split('.');
    expect(tokens.read(full.replace(DELIVERY, 'cm2zzzzzzzzzzzzzzzzzzzzzz'))).toBeNull();
    expect(tokens.read(`c1.${DELIVERY}.${signature}`)).toBeNull();
    expect(tokens.read(`cv1.${DELIVERY}.${compact.split('.')[2]}`)).toBeNull();
    expect(tokens.read(`xx.${DELIVERY}.${signature}`)).toBeNull();
    expect(tokens.read(`${compact}.extra`)).toBeNull();
    expect(tokens.read('')).toBeNull();
  });
});
