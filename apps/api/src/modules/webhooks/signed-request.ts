import { createHmac } from 'node:crypto';
import { safeEqual } from '../../common/crypto/crypto.service.js';

/**
 * Decodes Meta's `signed_request` (deauthorisation and data deletion
 * callbacks): `base64url(signature).base64url(payload)`, HMAC-SHA256 with the
 * app secret.
 */
export function parseSignedRequest(signedRequest: unknown, appSecret: string): { user_id?: string } | null {
  if (typeof signedRequest !== 'string' || signedRequest.length > 4096) return null;
  const [signature, payload] = signedRequest.split('.');
  if (!signature || !payload) return null;
  const expected = createHmac('sha256', appSecret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      algorithm?: string;
      user_id?: string | number;
    };
    if (data.algorithm?.toUpperCase() !== 'HMAC-SHA256') return null;
    return { user_id: data.user_id !== undefined ? String(data.user_id) : undefined };
  } catch {
    return null;
  }
}
