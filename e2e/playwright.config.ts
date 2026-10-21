import { defineConfig, devices } from '@playwright/test';
import {
  apiDir,
  apiEnv,
  apiUrl,
  appUrl,
  databaseUrl,
  ownerStateFile,
  redisUrl,
  sourceDatabaseUrl,
  webDir,
  webEnv,
} from './support/stack';

const ci = Boolean(process.env.CI);
const api = apiEnv();

/**
 * Starts an isolated Conversa (API, worker and web) with a simulated
 * Instagram and runs the specs against it, one at a time. The onboarding spec
 * creates the owner account the others sign in with.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: appUrl,
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: 'onboarding.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      testIgnore: 'onboarding.spec.ts',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: ownerStateFile },
    },
  ],
  // Started in order, each once the previous one answers.
  webServer: [
    {
      name: 'api',
      command: 'node ../../e2e/scripts/prepare.mjs && node dist/main.js',
      cwd: apiDir,
      url: `${apiUrl}/api/v1/health/ready`,
      env: {
        ...api,
        E2E_ADMIN_DATABASE_URL: sourceDatabaseUrl,
        E2E_WEB_API_URL: apiUrl,
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
      },
      // Includes building the apps.
      timeout: 600_000,
      reuseExistingServer: false,
    },
    {
      name: 'worker',
      command: 'node dist/worker.js',
      cwd: apiDir,
      env: { ...api, LOG_LEVEL: 'info' },
      wait: { stdout: /Worker started/ },
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      name: 'web',
      command: `pnpm exec next start --port ${webEnv().PORT}`,
      cwd: webDir,
      url: `${appUrl}/login`,
      env: webEnv(),
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
