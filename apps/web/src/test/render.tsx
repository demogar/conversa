import { MessagesProvider, ToastProvider } from '@demogar/mola-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import messages from '../../messages/en';

/** Renders with the providers every screen expects: messages, queries and toasts. */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <QueryClientProvider client={queryClient}>
          <MessagesProvider locale="en-US">
            <ToastProvider>{children}</ToastProvider>
          </MessagesProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** Return one from a mockApi route to answer with an API error. */
export class MockError {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string[]>,
  ) {}
}

// jsdom has no fetch Response; the API client only reads these members.
function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Replaces global fetch with a router of canned JSON answers, keyed by "METHOD /path". */
export function mockApi(routes: Record<string, unknown | ((body: unknown) => unknown)>) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const key = Object.keys(routes).find(
      (route) => route === `${method} ${path}` || route === `${method} ${path}${url.search}`,
    );
    if (!key) return jsonResponse(404, { error: { code: 'NOT_FOUND' } });
    const value = routes[key];
    const result = typeof value === 'function' ? (value as (b: unknown) => unknown)(body) : value;
    if (result instanceof MockError)
      return jsonResponse(result.status, { error: { code: result.code, fields: result.fields } });
    return result === undefined ? jsonResponse(204, null) : jsonResponse(200, result);
  }) as jest.Mock;
  return calls;
}
