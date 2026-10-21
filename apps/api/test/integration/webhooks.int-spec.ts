import request from 'supertest';
import { SandboxInstagramProvider } from '../../src/modules/channels/sandbox/sandbox-instagram.provider.js';
import {
  type Agent,
  API,
  automationInput,
  connectSandboxChannel,
  createTestApp,
  firstWorkspaceId,
  signUp,
  type TestApp,
} from './support/app.js';

describe('webhooks and tracked links', () => {
  let t: TestApp;
  let owner: Agent;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    t = await createTestApp();
    owner = t.agent();
    server = t.app.getHttpServer() as Parameters<typeof request>[0];
    await signUp(owner, { name: 'Olivia Owner', email: 'owner@example.com' });
  });

  afterAll(async () => {
    await t.close();
  });

  describe('GET /webhooks/:type (subscription check)', () => {
    it('refuses a wrong verify token', async () => {
      await request(server)
        .get(`${API}/webhooks/instagram`)
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong',
          'hub.challenge': 'challenge-123',
        })
        .expect(403);
    });

    it('answers 404 for an unknown platform', async () => {
      await request(server).get(`${API}/webhooks/myspace`).expect(404);
    });
  });

  describe('POST /webhooks/:type', () => {
    it('rejects a payload without a valid signature and stores nothing', async () => {
      // No Origin header: webhooks are server to server and skip the origin check.
      await request(server)
        .post(`${API}/webhooks/instagram`)
        .set('X-Hub-Signature-256', `sha256=${'0'.repeat(64)}`)
        .send({ object: 'instagram', entry: [] })
        .expect(401);
      await request(server)
        .post(`${API}/webhooks/instagram`)
        .send({ object: 'instagram', entry: [] })
        .expect(401);
      expect(await t.prisma.inboundEvent.count()).toBe(0);
    });
  });

  describe('setup status', () => {
    const status = () => owner.get(`${API}/instance/instagram/status`).expect(200);
    let sandbox: SandboxInstagramProvider;

    beforeAll(() => {
      sandbox = t.app.get(SandboxInstagramProvider);
    });

    // Tests stand in for Meta by shadowing the sandbox's methods; dropping the shadows restores them.
    afterEach(() => {
      const shadows = sandbox as Partial<SandboxInstagramProvider>;
      delete shadows.verifySubscription;
      delete shadows.verifySignature;
    });

    it('starts with nothing heard from Meta', async () => {
      const response = await status();
      expect(response.body).toEqual({
        sandbox: true,
        credentials: 'unknown',
        webhookVerifiedAt: null,
        lastEventAt: null,
      });
    });

    it('records when Meta last verified the webhook, but not a refused attempt', async () => {
      await request(server)
        .get(`${API}/webhooks/instagram`)
        .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'c' })
        .expect(403);
      expect((await status()).body.webhookVerifiedAt).toBeNull();

      // The sandbox refuses every handshake; stand in for a correctly configured Meta app.
      sandbox.verifySubscription = () => 'challenge-123';
      const verified = await request(server).get(`${API}/webhooks/instagram`).expect(200);
      expect(verified.text).toBe('challenge-123');
      const body = (await status()).body as { webhookVerifiedAt: string; lastEventAt: null };
      expect(Date.parse(body.webhookVerifiedAt)).toBeGreaterThan(Date.now() - 60_000);
      expect(body.lastEventAt).toBeNull();
    });

    it('records the last signed webhook, but not an unsigned one', async () => {
      await request(server)
        .post(`${API}/webhooks/instagram`)
        .send({ object: 'instagram', entry: [] })
        .expect(401);
      expect((await status()).body.lastEventAt).toBeNull();

      sandbox.verifySignature = () => true;
      await request(server)
        .post(`${API}/webhooks/instagram`)
        .send({ object: 'instagram', entry: [] })
        .expect(200);
      const body = (await status()).body as { lastEventAt: string };
      expect(Date.parse(body.lastEventAt)).toBeGreaterThan(Date.now() - 60_000);
    });

    it('is only for signed-in instance admins', async () => {
      await request(server).get(`${API}/instance/instagram/status`).expect(401);
    });
  });

  describe('GET /l/:slug', () => {
    it('redirects to the saved destination and records the click', async () => {
      const workspaceId = await firstWorkspaceId(owner);
      const channelId = await connectSandboxChannel(owner, workspaceId);
      const created = await owner
        .post(`${API}/workspaces/${workspaceId}/automations`)
        .send(automationInput(channelId))
        .expect(201);
      const link = await t.prisma.trackedLink.findFirstOrThrow({
        where: { automationId: created.body.id as string },
      });

      // Served outside the API prefix, and needs no session.
      const response = await request(server).get(`/l/${link.slug}`).expect(302);
      expect(response.headers.location).toBe('https://example.com/guide');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['referrer-policy']).toBe('no-referrer');

      // A forged delivery reference is ignored, but the click still counts.
      await request(server).get(`/l/${link.slug}`).query({ r: 'some-delivery.forged' }).expect(302);

      const clicks = await t.prisma.linkClick.findMany({ where: { linkId: link.id } });
      expect(clicks).toHaveLength(2);
      expect(clicks.every((click) => click.deliveryId === null)).toBe(true);

      const stats = await owner
        .get(`${API}/workspaces/${workspaceId}/automations/${created.body.id as string}`)
        .expect(200);
      // Both clicks came from the same visitor.
      expect(stats.body.stats.clicks).toBe(1);
    });

    it('answers 404 for an unknown or malformed slug', async () => {
      await request(server).get('/l/unknown99').expect(404);
      await request(server).get('/l/x').expect(404);
      await request(server).get(`${API}/l/unknown99`).expect(404);
      expect(await t.prisma.linkClick.count({ where: { link: { slug: 'unknown99' } } })).toBe(0);
    });
  });
});
