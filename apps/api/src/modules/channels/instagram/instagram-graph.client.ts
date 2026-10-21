import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.js';
import { ProviderError, type ProviderErrorKind } from '../provider/channel-provider.js';

const GRAPH_HOST = 'https://graph.instagram.com';
const TIMEOUT_MS = 15_000;

interface GraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/** Meta's error codes mapped onto what Conversa does about them. */
export function classifyGraphError(
  code: number | undefined,
  subcode: number | undefined,
  status: number,
): ProviderErrorKind {
  if (code === 190 || code === 102 || subcode === 463 || subcode === 460) return 'auth';
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80002 || status === 429)
    return 'rate_limit';
  // Code 10 with this subcode: the 24-hour messaging window has closed.
  if (code === 10 && subcode === 2534022) return 'window_closed';
  if (code === 1 || code === 2 || status >= 500) return 'transient';
  return 'rejected';
}

export interface GraphRequest {
  method?: 'GET' | 'POST' | 'DELETE';
  path: string;
  accessToken?: string;
  query?: Record<string, string>;
  body?: unknown;
  /** Send the body as a form instead of JSON (OAuth endpoints). */
  form?: Record<string, string>;
  host?: string;
}

/**
 * Thin HTTP client for the Instagram Graph API. Tokens travel in the
 * Authorization header, never the URL, so they stay out of proxy logs.
 */
@Injectable()
export class InstagramGraphClient {
  constructor(private readonly config: AppConfig) {}

  async request<T>(req: GraphRequest): Promise<T> {
    const host = req.host ?? `${GRAPH_HOST}/${this.config.env.META_GRAPH_VERSION}`;
    const url = new URL(`${host}${req.path}`);
    for (const [key, value] of Object.entries(req.query ?? {})) url.searchParams.set(key, value);

    const headers: Record<string, string> = {};
    if (req.accessToken) headers.Authorization = `Bearer ${req.accessToken}`;
    let body: string | undefined;
    if (req.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(req.form).toString();
    } else if (req.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: req.method ?? 'GET',
        headers,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new ProviderError('transient', `Instagram request failed: ${(error as Error).message}`);
    }

    const data = (await response.json().catch(() => ({}))) as T &
      GraphErrorBody & { error_message?: string };
    if (!response.ok || data.error) {
      const code = data.error?.code;
      const subcode = data.error?.error_subcode;
      const kind = classifyGraphError(code, subcode, response.status);
      const message = data.error?.message ?? data.error_message ?? `HTTP ${response.status}`;
      throw new ProviderError(
        kind,
        `Instagram ${url.pathname}: ${message} (code ${code ?? '-'}/${subcode ?? '-'}, trace ${data.error?.fbtrace_id ?? '-'})`,
        code !== undefined ? `${code}${subcode ? `.${subcode}` : ''}` : String(response.status),
      );
    }
    return data;
  }
}
