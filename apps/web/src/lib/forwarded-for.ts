import { subscribe } from 'node:diagnostics_channel';
import type { IncomingMessage } from 'node:http';

/**
 * Appends the address this server was connected from to X-Forwarded-For, as
 * any reverse proxy does. Next.js forwards /api and /l with the header the
 * client sent, untouched; with the real peer appended last, the API can tell
 * the entries proxies wrote from the ones a client made up (TRUST_PROXY).
 */
export function appendForwardedFor(request: IncomingMessage): void {
  const peer = request.socket.remoteAddress;
  if (!peer) return;
  const prior = request.headers['x-forwarded-for'];
  const chain = Array.isArray(prior) ? prior.join(', ') : prior;
  request.headers['x-forwarded-for'] = chain ? `${chain}, ${peer}` : peer;
}

const SUBSCRIBED = Symbol.for('conversa.forwarded-for');

/** Runs before Next.js sees each request, so every route, rewrites included, gets it. */
export function forwardClientAddresses(): void {
  const state = globalThis as { [SUBSCRIBED]?: boolean };
  if (state[SUBSCRIBED]) return;
  state[SUBSCRIBED] = true;
  subscribe('http.server.request.start', (message) => {
    appendForwardedFor((message as { request: IncomingMessage }).request);
  });
}
