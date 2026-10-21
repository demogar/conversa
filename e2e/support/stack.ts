import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/**
 * The isolated stack the end-to-end tests run against: its own API, worker
 * and web server on their own ports, with a separate database and Redis
 * database on the same servers as the development environment. Nothing here
 * names a host: the servers come from DATABASE_URL and REDIS_URL, read from
 * the environment (CI) or from the repository's .env (local development).
 */

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const e2eRoot = resolve(repoRoot, 'e2e');
export const apiDir = resolve(repoRoot, 'apps/api');
export const webDir = resolve(repoRoot, 'apps/web');

/** Where the setup project stores the owner's signed-in session. */
export const ownerStateFile = resolve(e2eRoot, '.auth/owner.json');

const dotenv: Record<string, string | undefined> = existsSync(resolve(repoRoot, '.env'))
  ? parseEnv(readFileSync(resolve(repoRoot, '.env'), 'utf8'))
  : {};

function setting(name: string): string | undefined {
  return process.env[name] || dotenv[name] || undefined;
}

function required(name: string): string {
  const value = setting(name);
  if (!value) throw new Error(`${name} is not set: export it or add it to the repository's .env`);
  return value;
}

export const apiPort = Number(process.env.E2E_API_PORT ?? 4100);
export const webPort = Number(process.env.E2E_WEB_PORT ?? 3100);
export const appUrl = `http://localhost:${webPort}`;
export const apiUrl = `http://localhost:${apiPort}`;

/** The development database URL; the e2e database is created next to it. */
export const sourceDatabaseUrl = required('DATABASE_URL');
const sourceRedisUrl = required('REDIS_URL');

function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

export const databaseUrl = withDatabase(
  sourceDatabaseUrl,
  process.env.E2E_DATABASE_NAME ?? 'conversa_e2e',
);
export const redisUrl = withDatabase(sourceRedisUrl, process.env.E2E_REDIS_DB ?? '14');

// Fresh for every run, and shared by the API and the worker: the worker
// decrypts the tokens the API stored.
const secretKey = randomBytes(48).toString('base64url');
const encryptionKey = randomBytes(32).toString('base64');

/**
 * Settings for the API and the worker. Every value the code reads is set
 * here, so nothing from the development .env leaks into the run. Mail, the
 * Meta app, Turnstile and the sign-up mode are instance settings, empty on
 * the fresh database: no mail (invitations show a link to copy), no captcha,
 * sign-up by invitation.
 */
export function apiEnv(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: process.env.E2E_LOG_LEVEL ?? 'warn',
    APP_URL: appUrl,
    API_PORT: String(apiPort),
    API_INTERNAL_URL: apiUrl,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    SECRET_KEY: secretKey,
    ENCRYPTION_KEY: encryptionKey,
    ENCRYPTION_KEYS_PREVIOUS: '',
    TRUST_PROXY: 'none',
    INSTAGRAM_SANDBOX: 'true',
    WORKER_IN_API: '',
  };
}

/** Settings for the Next.js server (a production build). */
export function webEnv(): Record<string, string> {
  return {
    NODE_ENV: 'production',
    API_INTERNAL_URL: apiUrl,
    PORT: String(webPort),
    NEXT_TELEMETRY_DISABLED: '1',
  };
}
