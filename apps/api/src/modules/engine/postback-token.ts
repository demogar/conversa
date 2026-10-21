import { Injectable } from '@nestjs/common';
import { CryptoService, safeEqual } from '../../common/crypto/crypto.service.js';

const PREFIX = 'cv1';

/**
 * Button payloads: `cv1.<deliveryId>.<signature>`. The payload comes back in a
 * webhook from whoever tapped the button, so it is signed: nobody can craft a
 * payload that advances another person's delivery.
 */
@Injectable()
export class PostbackTokens {
  constructor(private readonly crypto: CryptoService) {}

  create(deliveryId: string): string {
    return `${PREFIX}.${deliveryId}.${this.signature(deliveryId)}`;
  }

  read(payload: string): string | null {
    const [prefix, deliveryId, signature, extra] = payload.split('.');
    if (prefix !== PREFIX || !deliveryId || !signature || extra !== undefined) return null;
    return safeEqual(signature, this.signature(deliveryId)) ? deliveryId : null;
  }

  private signature(deliveryId: string): string {
    return this.crypto.hmac('postback', deliveryId).slice(0, 22);
  }
}
