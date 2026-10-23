import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { appUrl } from './stack';

/** The first account on the installation; the onboarding spec creates it. */
export const owner = {
  name: 'Olivia Owner',
  email: 'owner@example.com',
  password: 'a long and memorable owner passphrase',
};

/** Opens the app and waits for it to land in the person's first workspace. */
export async function openWorkspace(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/\/w\/[^/]+$/);
  return new URL(page.url()).pathname.split('/')[2]!;
}

/**
 * Calls the API with the page's session. State-changing requests carry the
 * app's Origin, as the browser would.
 */
export async function apiCall<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST',
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(`/api/v1${path}`, {
    method,
    data,
    headers: method === 'GET' ? {} : { Origin: appUrl },
  });
  expect(
    response.ok(),
    `${method} ${path} answered ${response.status()}: ${await response.text()}`,
  ).toBe(true);
  return (await response.json()) as T;
}

export interface Channel {
  id: string;
  type: 'INSTAGRAM' | 'TIKTOK';
  username: string;
  status: string;
}
