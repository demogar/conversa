// Gets the isolated end-to-end stack ready before its API starts: builds the
// apps (unless E2E_SKIP_BUILD=1), recreates the e2e database and applies the
// migrations, and empties the e2e Redis database. Playwright runs it as part
// of the API's webServer command, because web servers start before any
// globalSetup would.
//
// Reads DATABASE_URL and REDIS_URL (the e2e ones), E2E_ADMIN_DATABASE_URL (a
// database on the same server to connect to while the e2e one is recreated)
// and E2E_WEB_API_URL (the API address baked into the web build's rewrites).

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const apiDir = resolve(root, 'apps/api');
const webDir = resolve(root, 'apps/web');

function log(message) {
  process.stderr.write(`[e2e] ${message}\n`);
}

function run(command, args, options = {}) {
  log(`${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: ['ignore', 'inherit', 'inherit'], ...options });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
}

function build() {
  run('pnpm', ['--filter', '@conversa/shared', 'build'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  run('pnpm', ['--filter', '@conversa/api', 'build'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  // The rewrites to the API are fixed at build time, so the web app is built
  // for the e2e API. A production build leaves .next/dev, where `next dev`
  // works, untouched; next-env.d.ts is put back as `next dev` wrote it.
  const nextEnv = resolve(webDir, 'next-env.d.ts');
  const nextEnvBefore = readFileSync(nextEnv, 'utf8');
  try {
    run('pnpm', ['exec', 'next', 'build'], {
      cwd: webDir,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        API_INTERNAL_URL: process.env.E2E_WEB_API_URL,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    });
  } finally {
    writeFileSync(nextEnv, nextEnvBefore);
  }
}

async function resetDatabase() {
  const name = new URL(process.env.DATABASE_URL).pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unexpected e2e database name: ${name}`);
  const admin = new pg.Client({ connectionString: process.env.E2E_ADMIN_DATABASE_URL });
  await admin.connect();
  try {
    log(`recreating database ${name}`);
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
  run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

async function resetRedis() {
  const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  // Database 0 is where a development install keeps its data: never empty it.
  if (!redis.options.db)
    throw new Error('Refusing to empty Redis database 0; point REDIS_URL at another database');
  await redis.connect();
  try {
    log(`emptying Redis database ${redis.options.db}`);
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}

if (process.env.E2E_SKIP_BUILD !== '1') build();
await resetDatabase();
await resetRedis();
log('stack ready');
