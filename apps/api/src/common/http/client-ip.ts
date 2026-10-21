import { BlockList, isIP } from 'node:net';
import type { Request } from 'express';
import type { Env } from '../../config/env.js';

/**
 * Where the web server can sit: the same host, a Docker network or a private
 * LAN. Forwarding headers from any other peer are ignored, so reaching the
 * API directly never lets a client choose its own address.
 */
const PRIVATE_NETWORKS = new BlockList();
PRIVATE_NETWORKS.addSubnet('127.0.0.0', 8);
PRIVATE_NETWORKS.addSubnet('10.0.0.0', 8);
PRIVATE_NETWORKS.addSubnet('172.16.0.0', 12);
PRIVATE_NETWORKS.addSubnet('192.168.0.0', 16);
PRIVATE_NETWORKS.addSubnet('169.254.0.0', 16);
PRIVATE_NETWORKS.addSubnet('100.64.0.0', 10);
PRIVATE_NETWORKS.addAddress('::1', 'ipv6');
PRIVATE_NETWORKS.addSubnet('fc00::', 7, 'ipv6');
PRIVATE_NETWORKS.addSubnet('fe80::', 10, 'ipv6');

function normalize(address: string | undefined): string | null {
  const value = address?.trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');
  return value && isIP(value) ? value : null;
}

function isPrivate(address: string): boolean {
  return PRIVATE_NETWORKS.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
}

function header(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value.join(',') : value;
}

/**
 * The visitor's IP address. The API is always reached through the web
 * server, which appends the address it was connected from to
 * X-Forwarded-For (see apps/web/src/instrumentation.ts). TRUST_PROXY says
 * what is in front of the web server:
 * - `none`: nothing; the web server's peer is the visitor.
 * - a number `N`: N reverse proxies, each appending to X-Forwarded-For.
 * - `cloudflare`: Cloudflare's edge, which sets CF-Connecting-IP. Only safe
 *   when the origin is reachable through Cloudflare alone.
 */
export function resolveClientIp(request: Request, trustProxy: Env['TRUST_PROXY']): string {
  const peer = normalize(request.socket.remoteAddress);
  if (!peer) return 'unknown';
  if (!isPrivate(peer)) return peer;

  if (trustProxy === 'cloudflare') {
    const visitor = normalize(header(request, 'cf-connecting-ip'));
    if (visitor) return visitor;
  }

  // Walk the chain from the right: the web server's entry, then one per
  // trusted proxy. Anything further left was written by the client.
  const hops = typeof trustProxy === 'number' ? trustProxy : 0;
  const chain = (header(request, 'x-forwarded-for') ?? '').split(',');
  let ip = peer;
  for (let step = 0; step <= hops && step < chain.length; step++) {
    const entry = normalize(chain[chain.length - 1 - step]);
    if (!entry) break;
    ip = entry;
  }
  return ip;
}
