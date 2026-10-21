import { isIP } from 'node:net';
import type { Request } from 'express';
import type { Env } from '../../config/env.js';

/**
 * The visitor's IP address, read according to TRUST_PROXY:
 * - `none`: the socket address; forwarding headers are ignored.
 * - `cloudflare`: the CF-Connecting-IP header set by Cloudflare's edge. Only
 *   safe when the origin is reachable through Cloudflare alone.
 * - a hop count: Express' `trust proxy`, resolved into `req.ip`.
 */
export function resolveClientIp(request: Request, trustProxy: Env['TRUST_PROXY']): string {
  if (trustProxy === 'cloudflare') {
    const header = request.headers['cf-connecting-ip'];
    const value = Array.isArray(header) ? header[0] : header;
    if (value && isIP(value.trim())) return value.trim();
  }
  const ip = trustProxy === 'none' ? request.socket.remoteAddress : request.ip;
  return (ip ?? 'unknown').replace(/^::ffff:/, '');
}
