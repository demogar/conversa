import { readFileSync } from 'node:fs';
import request from 'supertest';
import { API, createTestApp, type TestApp } from './support/app.js';

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

describe('running version', () => {
  let t: TestApp;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await t.close();
  });

  it('is part of the liveness answer', async () => {
    const response = await request(server).get(`${API}/health`).expect(200);
    expect(response.body).toMatchObject({ status: 'ok', version });
    expect(Object.keys(response.body as object).sort()).toEqual(['commit', 'status', 'version']);
  });

  it('is public on the instance answer', async () => {
    const response = await request(server).get(`${API}/instance`).expect(200);
    expect(response.body.version).toBe(version);
  });
});
