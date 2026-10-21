import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';

const CIPHER = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FORMAT = 'v1';

interface Key {
  id: string;
  material: Buffer;
}

function toKey(base64: string): Key {
  const material = Buffer.from(base64, 'base64');
  const id = createHash('sha256').update(material).digest('hex').slice(0, 8);
  return { id, material };
}

/** Purposes keep signatures made for one feature from being valid in another. */
export type SigningPurpose = 'oauth-state' | 'mfa-challenge' | 'postback' | 'visitor' | 'link-ref';

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

@Injectable()
export class CryptoService {
  private readonly current: Key;
  private readonly keys: Map<string, Key>;
  private readonly secret: Buffer;

  constructor(config: AppConfig) {
    this.current = toKey(config.env.ENCRYPTION_KEY);
    const all = [this.current, ...config.env.ENCRYPTION_KEYS_PREVIOUS.map(toKey)];
    this.keys = new Map(all.map((key) => [key.id, key]));
    this.secret = Buffer.from(config.env.SECRET_KEY);
  }

  /**
   * Encrypts with the current key. The output names the key it used, so values
   * written before a rotation still decrypt with a previous key.
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(CIPHER, this.current.material, iv);
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const packed = Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
    return `${FORMAT}.${this.current.id}.${packed}`;
  }

  decrypt(value: string): string {
    const [format, keyId, packed] = value.split('.');
    const key = keyId ? this.keys.get(keyId) : undefined;
    if (format !== FORMAT || !key || !packed) throw new Error('Unreadable encrypted value');
    const data = Buffer.from(packed, 'base64url');
    const decipher = createDecipheriv(CIPHER, key.material, data.subarray(0, IV_BYTES));
    decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(data.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString(
      'utf8',
    );
  }

  /** True when the value was encrypted with a key that is no longer current. */
  needsReencryption(value: string): boolean {
    return value.split('.')[1] !== this.current.id;
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(value: string): T {
    return JSON.parse(this.decrypt(value)) as T;
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /** Tokens sent to people are stored only as this hash. */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  hmac(purpose: SigningPurpose, data: string): string {
    return createHmac('sha256', this.purposeKey(purpose)).update(data).digest('base64url');
  }

  /** Signs a JSON payload with an expiry: `payload.signature`, both base64url. */
  sign(purpose: SigningPurpose, payload: Record<string, unknown>, ttlSeconds: number): string {
    const body = Buffer.from(
      JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
    ).toString('base64url');
    return `${body}.${this.hmac(purpose, body)}`;
  }

  /** Returns the payload of a valid, unexpired token, or null. */
  verify<T extends Record<string, unknown>>(purpose: SigningPurpose, token: string | undefined | null): T | null {
    if (!token || token.length > 2048) return null;
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra !== undefined) return null;
    if (!safeEqual(signature, this.hmac(purpose, body))) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp?: unknown };
      if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private purposeKey(purpose: SigningPurpose): Buffer {
    return Buffer.from(hkdfSync('sha256', this.secret, Buffer.alloc(0), `conversa:${purpose}`, 32));
  }
}
