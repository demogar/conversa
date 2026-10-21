import request from 'supertest';
import { API, createTestApp, PASSWORD, type TestApp } from './support/app.js';

describe('auth', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('makes the first account the owner of a new workspace and signs it in with an httpOnly cookie', async () => {
    const owner = t.agent();
    const response = await owner
      .post(`${API}/auth/signup`)
      .send({ name: 'Olivia Owner', email: 'Owner@Example.com', password: PASSWORD })
      .expect(201);

    expect(response.body).toMatchObject({ email: 'owner@example.com', name: 'Olivia Owner' });
    expect(response.body).not.toHaveProperty('passwordHash');
    const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
    const session = cookies.find((cookie) => cookie.startsWith('conversa_session='));
    expect(session).toBeDefined();
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);

    const workspaces = await owner.get(`${API}/workspaces`).expect(200);
    expect(workspaces.body).toEqual([
      expect.objectContaining({ name: 'Olivia Owner', role: 'OWNER' }),
    ]);
  });

  it('closes sign-up after the first account', async () => {
    const response = await t
      .agent()
      .post(`${API}/auth/signup`)
      .send({ name: 'Second', email: 'second@example.com', password: PASSWORD })
      .expect(403);
    expect(response.body.error.code).toBe('SIGNUP_CLOSED');
    expect(await t.prisma.user.count()).toBe(1);
  });

  it('rejects state-changing requests without the app origin', async () => {
    const server = t.app.getHttpServer() as Parameters<typeof request>[0];
    const missing = await request(server)
      .post(`${API}/auth/login`)
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(403);
    expect(missing.body.error.code).toBe('CSRF_REJECTED');

    const foreign = await request(server)
      .post(`${API}/auth/login`)
      .set('Origin', 'https://attacker.example')
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(403);
    expect(foreign.body.error.code).toBe('CSRF_REJECTED');
  });

  it('logs out by revoking the session, not only clearing the cookie', async () => {
    const agent = t.agent();
    const login = await agent
      .post(`${API}/auth/login`)
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(200);
    expect(login.body.status).toBe('authenticated');
    const cookie = ([] as string[])
      .concat(login.headers['set-cookie'] ?? [])
      .find((value) => value.startsWith('conversa_session='))!
      .split(';')[0]!;

    await agent.get(`${API}/me`).expect(200);
    await agent.post(`${API}/auth/logout`).expect(204);
    await agent.get(`${API}/me`).expect(401);

    // Replaying the old cookie must not work either.
    const server = t.app.getHttpServer() as Parameters<typeof request>[0];
    const replay = await request(server).get(`${API}/me`).set('Cookie', cookie).expect(401);
    expect(replay.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('answers a wrong password with INVALID_CREDENTIALS and locks the account after five failures', async () => {
    const agent = t.agent();
    for (let attempt = 1; attempt <= 5; attempt++) {
      const response = await agent
        .post(`${API}/auth/login`)
        .send({ email: 'owner@example.com', password: 'wrong password!' })
        .expect(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    }

    // Even the right password is refused while the lock lasts.
    const locked = await agent
      .post(`${API}/auth/login`)
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');

    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: 'owner@example.com' } });
    expect(user.failedLogins).toBe(5);
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('gives an unknown email the same answer as a wrong password', async () => {
    const response = await t
      .agent()
      .post(`${API}/auth/login`)
      .send({ email: 'nobody@example.com', password: PASSWORD })
      .expect(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects invalid input with field codes', async () => {
    const response = await t
      .agent()
      .post(`${API}/auth/signup`)
      .send({ name: 'Short', email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.fields.password).toContain('password_too_short');
    expect(response.body.error.fields.email).toBeDefined();
  });
});
