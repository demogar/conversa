// Jest loads this file outside the test module system, so it imports no
// relative modules: everything it needs is here.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { Redis } from 'ioredis';
import pg from 'pg';

const TEST_DATABASE = 'conversa_test';
const TEST_REDIS_DB = 15;
const APP_URL = 'http://localhost:3000';

/** Variables from the repository's .env, without touching process.env. */
function dotenvValues(): Record<string, string> {
  for (const candidate of ['.env', '../../.env']) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) return parse(readFileSync(path));
  }
  return {};
}

/** The same server with the test database name, so a run never touches the development data. */
function testDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${TEST_DATABASE}`;
  return url.toString();
}

/** The same server on a logical database of its own. */
function testRedisUrl(redisUrl: string): string {
  const url = new URL(redisUrl);
  url.pathname = `/${TEST_REDIS_DB}`;
  return url.toString();
}

/**
 * Points the process at the test database and Redis and sets a test
 * configuration: fresh secrets and the simulated Instagram. Mail, captcha and
 * the sign-up mode are instance settings, empty on the fresh database.
 * Server addresses come from the environment (CI) or the repository's .env.
 */
function applyTestEnv(): { databaseUrl: string; redisUrl: string } {
  const fromFile = dotenvValues();
  const databaseUrl = process.env.DATABASE_URL ?? fromFile.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL ?? fromFile.REDIS_URL;
  if (!databaseUrl || !redisUrl) {
    throw new Error(
      'Integration tests need DATABASE_URL and REDIS_URL (environment or the repository .env)',
    );
  }

  const env: Record<string, string> = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    APP_URL,
    DATABASE_URL: testDatabaseUrl(databaseUrl),
    DB_POOL_MAX: '5',
    REDIS_URL: testRedisUrl(redisUrl),
    SECRET_KEY: randomBytes(48).toString('base64url'),
    ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    ENCRYPTION_KEYS_PREVIOUS: '',
    TRUST_PROXY: 'none',
    INSTAGRAM_SANDBOX: 'true',
    WORKER_IN_API: 'false',
  };
  Object.assign(process.env, env);
  return { databaseUrl: env.DATABASE_URL!, redisUrl: env.REDIS_URL! };
}

/** Creates the test database when missing and brings its schema up to date. */
async function ensureDatabase(databaseUrl: string): Promise<void> {
  const admin = new URL(databaseUrl);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DATABASE,
    ]);
    if (!rowCount) await client.query(`CREATE DATABASE "${TEST_DATABASE}"`);
  } finally {
    await client.end();
  }

  execFileSync(resolve(process.cwd(), 'node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

export default async function globalSetup(): Promise<void> {
  const { databaseUrl, redisUrl } = applyTestEnv();
  await ensureDatabase(databaseUrl);

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  try {
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}
