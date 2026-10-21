import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { generateSecret, generateURI, verify } from 'otplib';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';

const ISSUER = 'Conversa';
const RECOVERY_CODES = 8;
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

@Injectable()
export class MfaService {
  constructor(
    private readonly crypto: CryptoService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  createSecret(email: string): { secret: string; otpauthUrl: string } {
    const secret = generateSecret();
    return { secret, otpauthUrl: generateURI({ issuer: ISSUER, label: email, secret }) };
  }

  /**
   * Checks a TOTP code, allowing one step of clock drift. A code is accepted
   * once: a replay within its validity window is rejected.
   */
  async verifyCode(userId: string, encryptedSecret: string, code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) return false;
    const secret = this.crypto.decrypt(encryptedSecret);
    const result = await verify({ secret, token: code, epochTolerance: 30 });
    if (!result.valid) return false;
    const fresh = await this.redis.set(`conversa:mfa:used:${userId}:${code}`, '1', 'EX', 120, 'NX');
    return fresh === 'OK';
  }

  generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
    const codes = Array.from({ length: RECOVERY_CODES }, () => {
      const chars = Array.from(
        { length: 10 },
        () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)],
      );
      return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
    });
    return { codes, hashes: codes.map((code) => this.hashRecoveryCode(code)) };
  }

  hashRecoveryCode(code: string): string {
    return this.crypto.hashToken(code.trim().toLowerCase().replace(/\s+/g, ''));
  }
}
