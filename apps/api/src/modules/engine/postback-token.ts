import { Injectable, Module } from '@nestjs/common';
import { CryptoService, safeEqual } from '../../common/crypto/crypto.service.js';

const PREFIX = 'cv1';
const SIGNATURE_LENGTH = 22;
/** For platforms with short button ids: 40 characters fit a 25-character delivery id. */
const COMPACT_PREFIX = 'c1';
const COMPACT_SIGNATURE_LENGTH = 11;

/**
 * Button payloads: `cv1.<deliveryId>.<signature>`. The payload comes back in a
 * webhook from whoever tapped the button, so it is signed: nobody can craft a
 * payload that advances another person's delivery. Where a platform caps the
 * payload's length, `c1.<deliveryId>.<shorter signature>` is used instead
 * (66 bits, still far beyond guessing through taps).
 */
@Injectable()
export class PostbackTokens {
  constructor(private readonly crypto: CryptoService) {}

  create(deliveryId: string, maxLength = Number.POSITIVE_INFINITY): string {
    const signature = this.signature(deliveryId);
    const token = `${PREFIX}.${deliveryId}.${signature}`;
    if (token.length <= maxLength) return token;
    return `${COMPACT_PREFIX}.${deliveryId}.${signature.slice(0, COMPACT_SIGNATURE_LENGTH)}`;
  }

  read(payload: string): string | null {
    const [prefix, deliveryId, signature, extra] = payload.split('.');
    if (!deliveryId || !signature || extra !== undefined) return null;
    const length =
      prefix === PREFIX
        ? SIGNATURE_LENGTH
        : prefix === COMPACT_PREFIX
          ? COMPACT_SIGNATURE_LENGTH
          : null;
    if (length === null) return null;
    return safeEqual(signature, this.signature(deliveryId).slice(0, length)) ? deliveryId : null;
  }

  private signature(deliveryId: string): string {
    return this.crypto.hmac('postback', deliveryId).slice(0, SIGNATURE_LENGTH);
  }
}

/** Shared by the engine and the sandbox, which simulates taps on buttons. */
@Module({ providers: [PostbackTokens], exports: [PostbackTokens] })
export class PostbackTokensModule {}
