import { Injectable } from '@nestjs/common';
import { ProviderError, type ProviderErrorKind } from '../provider/channel-provider.js';
import { parseJsonKeepingIds } from './tiktok-json.js';

const API_HOST = 'https://business-api.tiktok.com/open_api/v1.3';
const TIMEOUT_MS = 15_000;

/** Codes TikTok answers with when the request worked (20001: partly). */
const SUCCESS_CODES = new Set([0, 20001]);
/** Expired, missing or invalid access or refresh tokens, and a failed refresh. */
const AUTH_CODES = new Set([40102, 40103, 40104, 40105, 40107, 40131]);
const RATE_LIMIT_CODES = new Set([40016, 40100]);

interface Envelope<T> {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
}

/** TikTok's return codes mapped onto what Conversa does about them. */
export function classifyTikTokError(code: number | undefined, status: number): ProviderErrorKind {
  if (code !== undefined && AUTH_CODES.has(code)) return 'auth';
  if ((code !== undefined && RATE_LIMIT_CODES.has(code)) || status === 429) return 'rate_limit';
  // The direct message rules (the 48-hour window, the message cap) blocked it.
  if (code === 40064) return 'window_closed';
  if ((code !== undefined && code >= 50000) || status >= 500) return 'transient';
  return 'rejected';
}

export interface TikTokRequest {
  method?: 'GET' | 'POST';
  path: string;
  accessToken?: string;
  /** Arrays and objects are sent as JSON, as TikTok expects for `fields` and `filters`. */
  query?: Record<string, string | number | boolean | unknown[] | object>;
  body?: unknown;
}

/**
 * Thin HTTP client for TikTok's API for Business. TikTok answers HTTP 200 for
 * most failures and puts the outcome in `code`, so that is what is checked.
 * Tokens travel in the Access-Token header and errors name the path only, so
 * a token never reaches a log line.
 */
@Injectable()
export class TikTokApiClient {
  async request<T>(req: TikTokRequest): Promise<T> {
    const url = new URL(`${API_HOST}${req.path}`);
    for (const [key, value] of Object.entries(req.query ?? {})) {
      url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
    const headers: Record<string, string> = {};
    if (req.accessToken) headers['Access-Token'] = req.accessToken;
    if (req.body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    let text: string;
    try {
      response = await fetch(url, {
        method: req.method ?? 'GET',
        headers,
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      text = await response.text();
    } catch (error) {
      throw new ProviderError('transient', `TikTok request failed: ${(error as Error).message}`);
    }

    let envelope: Envelope<T>;
    try {
      envelope = parseJsonKeepingIds(text) as Envelope<T>;
    } catch {
      envelope = {};
    }
    const code = typeof envelope.code === 'number' ? envelope.code : undefined;
    if (!response.ok || code === undefined || !SUCCESS_CODES.has(code)) {
      const kind = classifyTikTokError(
        code,
        response.ok && code === undefined ? 502 : response.status,
      );
      throw new ProviderError(
        kind,
        `TikTok ${url.pathname}: ${envelope.message ?? `HTTP ${response.status}`} (code ${code ?? '-'}, request ${envelope.request_id ?? '-'})`,
        code !== undefined ? String(code) : String(response.status),
      );
    }
    return (envelope.data ?? {}) as T;
  }
}
