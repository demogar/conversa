import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

// OWASP's recommended argon2id parameters (19 MiB, 2 iterations).
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  private dummyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return argon2.hash(password, OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Spends the same time as a real check, so a sign-in for an unknown email
   * cannot be told apart from a wrong password by its response time.
   */
  async verifyAgainstDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('conversa-timing-equaliser');
    await this.verify(await this.dummyHash, password);
    return false;
  }
}
