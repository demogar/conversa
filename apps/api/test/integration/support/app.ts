import { type INestApplication, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { AppModule } from '../../../src/app.module.js';
import { configureApp } from '../../../src/bootstrap.js';
import { REDIS } from '../../../src/infra/redis/redis.module.js';
import { PrismaService } from '../../../src/infra/prisma/prisma.service.js';
import { WorkerModule } from '../../../src/worker.module.js';

export const API = '/api/v1';
/** Set by the global setup. */
export const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
export const PASSWORD = 'correct horse battery staple';

export type Agent = ReturnType<typeof request.agent>;

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  redis: Redis;
  /** A browser-like client: keeps cookies and sends the app's Origin. */
  agent(): Agent;
  close(): Promise<void>;
}

/** Empties every table, so each test file starts from a fresh instance. */
async function truncateAll(prisma: PrismaService): Promise<void> {
  const [{ database }] = await prisma.$queryRaw<
    [{ database: string }]
  >`SELECT current_database() AS database`;
  if (database !== 'conversa_test')
    throw new Error(`Refusing to empty ${database}: not the test database`);
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Boots the API the way main.ts does, on a clean database and Redis. With
 * `worker`, the queue processors run in the same process, as with
 * WORKER_IN_API.
 */
export async function createTestApp(options: { worker?: boolean } = {}): Promise<TestApp> {
  @Module({ imports: [AppModule, ...(options.worker ? [WorkerModule] : [])] })
  class TestRootModule {}

  const moduleRef = await Test.createTestingModule({ imports: [TestRootModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    rawBody: true,
    bufferLogs: true,
  });
  configureApp(app);

  const prisma = app.get(PrismaService);
  const redis = app.get<Redis>(REDIS);
  await truncateAll(prisma);
  await redis.flushdb();
  await app.init();

  const server = app.getHttpServer() as Parameters<typeof request.agent>[0];
  return {
    app,
    prisma,
    redis,
    agent: () => request.agent(server).set('Origin', APP_URL),
    close: () => app.close(),
  };
}

/** Polls until the probe returns a value, failing after the timeout. */
export async function waitFor<T>(
  probe: () => Promise<T | null | undefined | false>,
  description: string,
  timeoutMs = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${description}`);
    await new Promise((done) => setTimeout(done, 100));
  }
}

export interface SignedUpUser {
  id: string;
  email: string;
}

export async function signUp(
  agent: Agent,
  input: { name: string; email: string; invitationToken?: string },
): Promise<SignedUpUser> {
  const response = await agent
    .post(`${API}/auth/signup`)
    .send({ ...input, password: PASSWORD })
    .expect(201);
  return response.body as SignedUpUser;
}

/** The id of the signed-in user's first workspace. */
export async function firstWorkspaceId(agent: Agent): Promise<string> {
  const response = await agent.get(`${API}/workspaces`).expect(200);
  const [workspace] = response.body as Array<{ id: string }>;
  if (!workspace) throw new Error('The user has no workspace');
  return workspace.id;
}

/** Connects a simulated Instagram account by following the OAuth redirect, as a browser would. */
export async function connectSandboxChannel(
  agent: Agent,
  workspaceId: string,
  platform: 'instagram' | 'tiktok' = 'instagram',
): Promise<string> {
  const started = await agent
    .post(`${API}/workspaces/${workspaceId}/channels/${platform}/connect`)
    .expect(201);
  const callback = new URL((started.body as { url: string }).url);
  expect(callback.origin).toBe(APP_URL);

  const finished = await agent.get(`${callback.pathname}${callback.search}`).expect(303);
  const location = new URL(finished.headers.location as string);
  const channelId = location.searchParams.get('connected');
  if (!channelId) throw new Error(`Connecting failed: ${location.toString()}`);
  return channelId;
}

/** A valid automation body; tests override what they exercise. */
export function automationInput(channelId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: 'Send the guide',
    channelId,
    triggerType: 'COMMENT',
    postScope: 'ANY',
    matchMode: 'KEYWORDS',
    keywords: ['LINK'],
    status: 'ACTIVE',
    response: {
      publicReply: { enabled: true, variants: ['Check your DMs!'] },
      message: {
        text: 'Here is the guide, {username}',
        buttons: [{ label: 'Open guide', url: 'https://example.com/guide' }],
      },
    },
    ...overrides,
  };
}
