import { generate } from 'otplib';
import request from 'supertest';
import { CryptoService } from '../../src/common/crypto/crypto.service.js';
import {
  API,
  automationInput,
  connectSandboxChannel,
  createTestApp,
  firstWorkspaceId,
  PASSWORD,
  signUp,
  type TestApp,
} from './support/app.js';

describe('security', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await signUp(t.agent(), { name: 'Olivia Owner', email: 'owner@example.com' });
  });

  afterAll(async () => {
    await t.close();
  });

  it('records the address the web server appended, not one the client wrote before it', async () => {
    await t
      .agent()
      .post(`${API}/auth/login`)
      .set('X-Forwarded-For', '198.51.100.1, 203.0.113.7')
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(200);

    const session = await t.prisma.session.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });
    expect(session.ip).toBe('203.0.113.7');
  });

  it('resolves the visitor address on routes served outside the API prefix', async () => {
    const owner = t.agent();
    await owner
      .post(`${API}/auth/login`)
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(200);
    const workspaceId = await firstWorkspaceId(owner);
    const channelId = await connectSandboxChannel(owner, workspaceId);
    const created = await owner
      .post(`${API}/workspaces/${workspaceId}/automations`)
      .send(automationInput(channelId))
      .expect(201);
    const link = await t.prisma.trackedLink.findFirstOrThrow({
      where: { automationId: created.body.id as string },
    });

    const server = t.app.getHttpServer() as Parameters<typeof request>[0];
    for (const forwardedFor of ['198.51.100.1, 203.0.113.7', '203.0.113.8']) {
      await request(server).get(`/l/${link.slug}`).set('X-Forwarded-For', forwardedFor).expect(302);
    }

    const crypto = t.app.get(CryptoService);
    const visitorHash = (ip: string) => crypto.hmac('visitor', `${link.id}:${ip}`).slice(0, 32);
    const clicks = await t.prisma.linkClick.findMany({
      where: { linkId: link.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(clicks.map((click) => click.visitorHash)).toEqual([
      visitorHash('203.0.113.7'),
      visitorHash('203.0.113.8'),
    ]);
  });

  it('counts every failure of a burst of parallel wrong passwords', async () => {
    const attempts = Array.from({ length: 5 }, () =>
      t
        .agent()
        .post(`${API}/auth/login`)
        .send({ email: 'owner@example.com', password: 'wrong password!' }),
    );
    for (const response of await Promise.all(attempts)) expect(response.status).toBe(401);

    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: 'owner@example.com' } });
    expect(user.failedLogins).toBe(5);
    expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    await t.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
  });

  it('accepts a recovery code once, even for requests racing with it', async () => {
    const agent = t.agent();
    await agent
      .post(`${API}/auth/login`)
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(200);
    const setup = await agent.post(`${API}/me/mfa/setup`).expect(201);
    const enabled = await agent
      .post(`${API}/me/mfa/enable`)
      .send({ code: await generate({ secret: (setup.body as { secret: string }).secret }) })
      .expect(201);
    const [recoveryCode] = (enabled.body as { recoveryCodes: string[] }).recoveryCodes;

    const login = await t
      .agent()
      .post(`${API}/auth/login`)
      .send({ email: 'owner@example.com', password: PASSWORD })
      .expect(200);
    expect(login.body.status).toBe('mfa_required');

    const verifications = Array.from({ length: 3 }, () =>
      t
        .agent()
        .post(`${API}/auth/mfa`)
        .send({ challenge: login.body.challenge, code: recoveryCode }),
    );
    const statuses = (await Promise.all(verifications)).map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);

    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: 'owner@example.com' } });
    expect(user.mfaRecoveryHashes).toHaveLength(7);
  });
});
