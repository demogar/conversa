import { createHmac } from 'node:crypto';
import request from 'supertest';
import { CHANNEL_CAPABILITIES } from '@conversa/shared';
import { SandboxTikTokProvider } from '../../src/modules/channels/sandbox/sandbox-tiktok.provider.js';
import type { ChannelProvider } from '../../src/modules/channels/provider/channel-provider.js';
import { sandboxUserId } from '../../src/modules/channels/sandbox/sandbox-events.js';
import type { SandboxOutboxEntry } from '../../src/modules/channels/sandbox/sandbox-outbox.js';
import { TikTokProvider } from '../../src/modules/channels/tiktok/tiktok.provider.js';
import {
  type Agent,
  API,
  APP_URL,
  automationInput,
  connectSandboxChannel,
  createTestApp,
  firstWorkspaceId,
  signUp,
  type TestApp,
  waitFor,
} from './support/app.js';

const APP_SECRET = 'tiktok0secret0value0for0tests0only00000';
const AUTHORIZATION_URL =
  'https://www.tiktok.com/v2/auth/authorize?client_key=7300000000000000001&scope=user.info.basic&response_type=code';

/** The simulated TikTok end to end: direct messages through the real parser, queues and worker. */
describe('TikTok (sandbox)', () => {
  let t: TestApp;
  let owner: Agent;
  let server: Parameters<typeof request>[0];
  let workspaceId: string;
  let channelId: string;
  let sandbox: string;
  let automations: string;

  beforeAll(async () => {
    t = await createTestApp({ worker: true });
    owner = t.agent();
    server = t.app.getHttpServer() as Parameters<typeof request>[0];
    await signUp(owner, { name: 'Olivia Owner', email: 'owner@example.com' });
    workspaceId = await firstWorkspaceId(owner);
    channelId = await connectSandboxChannel(owner, workspaceId, 'tiktok');
    sandbox = `${API}/workspaces/${workspaceId}/channels/${channelId}/sandbox`;
    automations = `${API}/workspaces/${workspaceId}/automations`;

    await owner
      .post(automations)
      .send(
        automationInput(channelId, {
          name: 'Price list',
          triggerType: 'MESSAGE',
          keywords: ['PRICE'],
          response: {
            message: {
              text: 'Here are the prices, {username}',
              buttons: [{ label: 'Prices', url: 'https://example.com/prices' }],
            },
            followGate: {
              enabled: true,
              text: 'Follow us first, then tap the button and the list is yours.',
              buttonLabel: 'I follow',
            },
          },
        }),
      )
      .expect(201);
  });

  afterAll(async () => {
    await t.close();
  });

  async function message(username: string, text: string): Promise<void> {
    await owner.post(`${sandbox}/events`).send({ kind: 'message', username, text }).expect(202);
  }

  function deliveryFor(username: string, status: string) {
    return waitFor(
      () =>
        t.prisma.delivery.findFirst({
          where: { contact: { externalId: sandboxUserId(username) }, status: status as never },
        }),
      `a ${status} delivery for ${username}`,
    );
  }

  async function outbox(): Promise<SandboxOutboxEntry[]> {
    const response = await owner.get(`${sandbox}/outbox`).expect(200);
    return (response.body as SandboxOutboxEntry[]).reverse();
  }

  it('connects through the callback URL that ends in a slash, as TikTok requires', async () => {
    const channels = await owner.get(`${API}/workspaces/${workspaceId}/channels`).expect(200);
    expect(channels.body).toEqual([
      expect.objectContaining({ id: channelId, type: 'TIKTOK', status: 'ACTIVE' }),
    ]);
  });

  it('refuses comment automations, which TikTok cannot answer privately', async () => {
    const response = await owner.post(automations).send(automationInput(channelId)).expect(400);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { triggerType: ['not_supported_by_channel'] },
    });
    await owner
      .post(`${sandbox}/events`)
      .send({ kind: 'comment', username: 'x', text: 'hi' })
      .expect(400);
  });

  it('gates the content behind a tap, then sends it with the link written into the text', async () => {
    await message('ana', 'what is the PRICE?');
    const delivery = await deliveryFor('ana', 'AWAITING_TAP');
    const contact = await t.prisma.contact.findFirstOrThrow({
      where: { externalId: sandboxUserId('ana') },
    });
    // The username and follow status came with the message itself.
    expect(contact).toMatchObject({ username: 'ana', isFollower: true });

    const [gate] = await outbox();
    expect(gate).toMatchObject({ kind: 'message', recipient: sandboxUserId('ana') });
    const button = gate!.message.buttons?.[0] as { type: string; payload: string };
    expect(button.type).toBe('postback');
    expect(button.payload.length).toBeLessThanOrEqual(
      CHANNEL_CAPABILITIES.TIKTOK.postbackPayloadLength,
    );

    await owner.post(`${sandbox}/taps`).send({ deliveryId: delivery.id }).expect(202);
    const sent = await deliveryFor('ana', 'SENT');
    expect(sent.id).toBe(delivery.id);
    const content = (await outbox()).at(-1)!;
    expect(content.message.text).toBe('Here are the prices, @ana');
    const link = content.message.buttons?.[0] as { type: string; url: string };
    expect(link.type).toBe('url');
    expect(new URL(link.url).origin).toBe(APP_URL);
  });

  it('asks again when the message says the contact does not follow', async () => {
    await message('bo_nofollow', 'PRICE');
    const delivery = await deliveryFor('bo_nofollow', 'AWAITING_TAP');
    await owner.post(`${sandbox}/taps`).send({ deliveryId: delivery.id }).expect(202);
    const waiting = await deliveryFor('bo_nofollow', 'AWAITING_FOLLOW');
    expect(waiting).toMatchObject({ id: delivery.id, followPrompts: 1, sentAt: null });
  });

  it('lists conversations named after their contacts', async () => {
    const response = await owner
      .get(`${API}/workspaces/${workspaceId}/channels/${channelId}/conversations`)
      .expect(200);
    const ana = (response.body as Array<{ participant: { id: string; username: string } }>).find(
      (conversation) => conversation.participant.id === sandboxUserId('ana'),
    );
    expect(ana?.participant.username).toBe('ana');
  });

  describe('app settings and webhook signatures', () => {
    let shadowed: SandboxTikTokProvider;

    beforeAll(() => {
      shadowed = t.app.get(SandboxTikTokProvider);
    });

    afterEach(() => {
      delete (shadowed as Partial<SandboxTikTokProvider>).verifySignature;
    });

    it('stores the app without ever returning the secret', async () => {
      await owner
        .patch(`${API}/instance/settings/tiktok`)
        .send({
          appId: '7300000000000000001',
          appSecret: APP_SECRET,
          authorizationUrl: 'https://evil.example.com/',
        })
        .expect(400);
      const saved = await owner
        .patch(`${API}/instance/settings/tiktok`)
        .send({
          appId: '7300000000000000001',
          appSecret: APP_SECRET,
          authorizationUrl: AUTHORIZATION_URL,
        })
        .expect(200);
      expect(JSON.stringify(saved.body)).not.toContain(APP_SECRET);
      expect(saved.body.tiktok).toMatchObject({
        configured: true,
        appId: '7300000000000000001',
        authorizationUrl: AUTHORIZATION_URL,
        urls: {
          oauthRedirect: `${APP_URL}/api/v1/channels/oauth/tiktok/callback/`,
          webhook: `${APP_URL}/api/v1/webhooks/tiktok`,
        },
      });
    });

    it("checks TikTok's signature over the raw body and stores only signed deliveries", async () => {
      // The sandbox refuses every real-looking webhook; stand in the real TikTok check.
      const real = t.app.get(TikTokProvider);
      (shadowed as ChannelProvider).verifySignature = (raw, headers) =>
        real.verifySignature(raw, headers);

      const body = JSON.stringify({ event: 'im_mark_read_msg', user_openid: 'x', content: '{}' });
      const now = Math.floor(Date.now() / 1000);
      const sign = (secret: string, t0 = now) =>
        `t=${t0},s=${createHmac('sha256', secret).update(`${t0}.${body}`).digest('hex')}`;
      const post = (signature?: string) => {
        const req = request(server)
          .post(`${API}/webhooks/tiktok`)
          .set('Content-Type', 'application/json');
        return (signature ? req.set('Tiktok-Signature', signature) : req).send(body);
      };

      const before = await t.prisma.inboundEvent.count({ where: { channelType: 'TIKTOK' } });
      await post().expect(401);
      await post(sign('wrong-secret')).expect(401);
      await post(sign(APP_SECRET, now - 3600)).expect(401);
      expect(await t.prisma.inboundEvent.count({ where: { channelType: 'TIKTOK' } })).toBe(before);

      await post(sign(APP_SECRET)).expect(200);
      expect(await t.prisma.inboundEvent.count({ where: { channelType: 'TIKTOK' } })).toBe(
        before + 1,
      );

      const status = await owner.get(`${API}/instance/tiktok/status`).expect(200);
      expect(Date.parse(status.body.lastEventAt as string)).toBeGreaterThan(Date.now() - 60_000);
    });

    it('has no subscription handshake', async () => {
      await request(server).get(`${API}/webhooks/tiktok`).query({ challenge: 'x' }).expect(403);
    });
  });
});
