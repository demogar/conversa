import type { ApiErrorBody, ErrorCode } from '@conversa/shared';

/** A failed API call, carrying the stable code the UI translates. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Reads one API path. Query options take one, so the browser (through /api)
 * and the server's prefetch (straight to the API) fill the same cache entries.
 */
export type ApiGet = <T>(path: string, signal?: AbortSignal) => Promise<T>;

/**
 * Calls the API through the app's own origin (/api is proxied), so the
 * session cookie is first-party and the browser sends the Origin header the
 * API checks on every write.
 */
export async function apiRequest<T>(
  method: Method,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code ?? 'INTERNAL', data?.error?.fields ?? {});
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>('GET', path, undefined, signal),
  post: <T>(path: string, body?: unknown) => apiRequest<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => apiRequest<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => apiRequest<T>('PATCH', path, body),
  delete: <T = void>(path: string) => apiRequest<T>('DELETE', path),
};

/** Builds a query string, dropping empty values. */
export function query(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
