import { expect, test } from '@playwright/test';
import { appUrl } from '../support/stack';

test.describe('signed in', () => {
  test('a state-changing request without an Origin header is refused', async ({ request }) => {
    const response = await request.post('/api/v1/workspaces', { data: { name: 'Forged' } });
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe('CSRF_REJECTED');
  });

  test('a request from another origin is refused', async ({ request }) => {
    const response = await request.post('/api/v1/workspaces', {
      data: { name: 'Forged' },
      headers: { Origin: 'https://attacker.example' },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe('CSRF_REJECTED');
  });
});

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('workspace pages redirect to sign in', async ({ request }) => {
    const response = await request.get('/w/any-workspace/automations', { maxRedirects: 0 });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    const location = new URL(response.headers()['location']!, appUrl);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/w/any-workspace/automations');
  });

  test('the API refuses a request without a session', async ({ request }) => {
    const response = await request.get('/api/v1/workspaces');
    expect(response.status()).toBe(401);
  });

  test('pages are served with a strict Content Security Policy', async ({ request }) => {
    const response = await request.get('/login');
    expect(response.status()).toBe(200);
    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    const nonce = /'nonce-([^']+)'/.exec(csp!)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // The page's own scripts carry this response's nonce.
    expect(await response.text()).toContain(`nonce="${nonce}"`);

    const again = await request.get('/login');
    expect(again.headers()['content-security-policy']).not.toContain(`'nonce-${nonce}'`);
  });
});
