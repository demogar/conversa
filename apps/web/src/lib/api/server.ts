import 'server-only';

import { type ApiErrorBody, hasRole, type MeDto } from '@conversa/shared';
import {
  dehydrate,
  type DehydratedState,
  type FetchInfiniteQueryOptions,
  type FetchQueryOptions,
  QueryClient,
} from '@tanstack/react-query';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { safeNextPath } from '@/lib/navigation';
import { ApiError, type ApiGet } from './client';

const API_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const SESSION_COOKIES = ['__Host-conversa_session', 'conversa_session'];

/**
 * What the API needs to treat this call as the visitor's own: the session
 * cookie and nothing else of theirs, plus the address chain. X-Forwarded-For
 * already ends with the visitor's address (see src/instrumentation.ts), and
 * CF-Connecting-IP is only believed by the API behind Cloudflare, so both go
 * on exactly as the /api rewrite would send them and rate limits and session
 * records keep the visitor's address rather than this server's.
 */
async function forwardedHeaders(): Promise<Headers> {
  const [jar, incoming] = await Promise.all([cookies(), headers()]);
  const forwarded = new Headers({ accept: 'application/json' });
  const session = SESSION_COOKIES.flatMap((name) => {
    const cookie = jar.get(name);
    return cookie ? [`${name}=${encodeURIComponent(cookie.value)}`] : [];
  });
  if (session.length > 0) forwarded.set('cookie', session.join('; '));
  for (const name of ['x-forwarded-for', 'cf-connecting-ip']) {
    const value = incoming.get(name);
    if (value) forwarded.set(name, value);
  }
  return forwarded;
}

/** Once per path per request, so a layout and its page both asking for /me make one call. */
const load = cache(async (path: string): Promise<unknown> => {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    headers: await forwardedHeaders(),
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => null)) as Partial<ApiErrorBody> | null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code ?? 'INTERNAL', data?.error?.fields ?? {});
  }
  return data;
});

/** The server's way to read the API, for query options' `get`. */
export const serverGet: ApiGet = <T>(path: string) => load(path) as Promise<T>;

/** A lost session sends the person to sign in and back to this page, as the browser does. */
async function signIn(): Promise<never> {
  const current = safeNextPath((await headers()).get('x-pathname'), '');
  redirect(current && current !== '/' ? `/login?next=${encodeURIComponent(current)}` : '/login');
}

const isUnauthenticated = (error: unknown) => error instanceof ApiError && error.status === 401;

/** Options from a hooks file's factory, plain or infinite; each has its own data type. */
type Prefetchable = { queryKey: readonly unknown[]; queryFn?: unknown };

/**
 * Runs the queries a page opens with, on the server, and returns them for a
 * HydrationBoundary: the first HTML already has the content and the browser
 * starts with a warm cache. A query that fails is left out, so the screen
 * fetches it again and shows its own error state.
 */
export async function prefetch(...queries: Prefetchable[]): Promise<DehydratedState> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });
  await Promise.all(
    queries.map((options) =>
      'getNextPageParam' in options
        ? client.prefetchInfiniteQuery(options as unknown as FetchInfiniteQueryOptions)
        : client.prefetchQuery(options as FetchQueryOptions),
    ),
  );
  if (
    client
      .getQueryCache()
      .getAll()
      .some((query) => isUnauthenticated(query.state.error))
  ) {
    await signIn();
  }
  return dehydrate(client);
}

/** Whether the signed-in person is at least an admin of the workspace, for admin-only prefetches. */
export async function isWorkspaceAdmin(workspaceId: string): Promise<boolean> {
  const me = await serverGet<MeDto>('/me').catch(() => null);
  const role = me?.workspaces.find((workspace) => workspace.id === workspaceId)?.role;
  return role !== undefined && hasRole(role, 'ADMIN');
}
