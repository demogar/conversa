import type { Request } from 'express';
import { resolveClientIp } from './client-ip.js';

// The web server's address on the Docker network.
const WEB = '::ffff:172.18.0.4';

function request(peer: string | undefined, headers: Record<string, string | string[]> = {}) {
  return { socket: { remoteAddress: peer }, headers } as unknown as Request;
}

describe('resolveClientIp', () => {
  it('uses the address the web server appended when nothing is in front of it', () => {
    expect(resolveClientIp(request(WEB, { 'x-forwarded-for': '203.0.113.7' }), 'none')).toBe(
      '203.0.113.7',
    );
  });

  it('ignores what a client wrote into X-Forwarded-For before the web server appended', () => {
    const forged = request(WEB, { 'x-forwarded-for': '198.51.100.1, 203.0.113.7' });
    expect(resolveClientIp(forged, 'none')).toBe('203.0.113.7');
    expect(resolveClientIp(forged, 1)).toBe('198.51.100.1');
  });

  it('trusts one entry per reverse proxy in front of the web server', () => {
    // client-forged, the visitor (appended by the proxy), the proxy (appended by the web server)
    const chain = request(WEB, { 'x-forwarded-for': '198.51.100.1, 203.0.113.7, 10.0.0.2' });
    expect(resolveClientIp(chain, 1)).toBe('203.0.113.7');
    expect(resolveClientIp(chain, 0)).toBe('10.0.0.2');
  });

  it('stops at the start of a chain shorter than the hop count', () => {
    expect(resolveClientIp(request(WEB, { 'x-forwarded-for': '203.0.113.7' }), 3)).toBe(
      '203.0.113.7',
    );
  });

  it('stops at an entry that is not an address', () => {
    expect(
      resolveClientIp(request(WEB, { 'x-forwarded-for': 'garbage, 203.0.113.7, 10.0.0.2' }), 2),
    ).toBe('203.0.113.7');
  });

  it('falls back to the peer without forwarding headers', () => {
    expect(resolveClientIp(request('::ffff:127.0.0.1'), 'none')).toBe('127.0.0.1');
    expect(resolveClientIp(request('::1'), 2)).toBe('::1');
  });

  it('ignores forwarding headers from a peer outside private networks', () => {
    const direct = request('203.0.113.50', {
      'x-forwarded-for': '198.51.100.1',
      'cf-connecting-ip': '198.51.100.2',
    });
    expect(resolveClientIp(direct, 'none')).toBe('203.0.113.50');
    expect(resolveClientIp(direct, 2)).toBe('203.0.113.50');
    expect(resolveClientIp(direct, 'cloudflare')).toBe('203.0.113.50');
  });

  it('reads CF-Connecting-IP only in cloudflare mode', () => {
    const tunnelled = request(WEB, {
      'cf-connecting-ip': '2001:db8::5',
      'x-forwarded-for': '172.18.0.9',
    });
    expect(resolveClientIp(tunnelled, 'cloudflare')).toBe('2001:db8::5');
    expect(resolveClientIp(tunnelled, 'none')).toBe('172.18.0.9');
  });

  it('falls back to the chain when CF-Connecting-IP is missing or invalid', () => {
    expect(
      resolveClientIp(
        request(WEB, { 'cf-connecting-ip': 'nope', 'x-forwarded-for': '172.18.0.9' }),
        'cloudflare',
      ),
    ).toBe('172.18.0.9');
  });

  it('answers unknown without a usable socket address', () => {
    expect(resolveClientIp(request(undefined), 'none')).toBe('unknown');
  });
});
