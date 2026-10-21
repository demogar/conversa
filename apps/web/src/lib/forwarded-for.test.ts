/** @jest-environment node */
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { appendForwardedFor, forwardClientAddresses } from './forwarded-for';

function incoming(peer: string | undefined, forwardedFor?: string | string[]): IncomingMessage {
  return {
    socket: { remoteAddress: peer },
    headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor },
  } as unknown as IncomingMessage;
}

describe('appendForwardedFor', () => {
  it('starts the chain with the peer', () => {
    const request = incoming('203.0.113.7');
    appendForwardedFor(request);
    expect(request.headers['x-forwarded-for']).toBe('203.0.113.7');
  });

  it('appends the peer after whatever the client or a proxy sent', () => {
    const request = incoming('10.0.0.2', '198.51.100.1, 203.0.113.7');
    appendForwardedFor(request);
    expect(request.headers['x-forwarded-for']).toBe('198.51.100.1, 203.0.113.7, 10.0.0.2');
  });

  it('leaves the request alone without a peer address', () => {
    const request = incoming(undefined, '198.51.100.1');
    appendForwardedFor(request);
    expect(request.headers['x-forwarded-for']).toBe('198.51.100.1');
  });
});

describe('forwardClientAddresses', () => {
  it('stamps every request the server receives, once', async () => {
    forwardClientAddresses();
    forwardClientAddresses();
    const server = createServer((request, response) => {
      response.end(String(request.headers['x-forwarded-for']));
    });
    await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening));
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { 'X-Forwarded-For': '198.51.100.1' },
      });
      expect(await response.text()).toBe('198.51.100.1, 127.0.0.1');
    } finally {
      server.close();
    }
  });
});
