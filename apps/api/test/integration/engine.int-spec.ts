import request from 'supertest';
import { InboundEventIngestor } from '../../src/modules/webhooks/inbound-event.ingestor.js';
import {
  buildCommentPayload,
  sandboxUserId,
} from '../../src/modules/channels/sandbox/sandbox-events.js';
import type { SandboxOutboxEntry } from '../../src/modules/channels/sandbox/sandbox-outbox.js';
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

/** The simulated Instagram end to end: sandbox events through the real queues and worker. */
describe('engine (sandbox)', () => {
  let t: TestApp;
  let owner: Agent;
  let channelId: string;
  let sandbox: string;
  let guideAutomationId: string;

  beforeAll(async () => {
    t = await createTestApp({ worker: true });
    owner = t.agent();
    await signUp(owner, { name: 'Olivia Owner', email: 'owner@example.com' });
    const workspaceId = await firstWorkspaceId(owner);
    channelId = await connectSandboxChannel(owner, workspaceId);
    sandbox = `${API}/workspaces/${workspaceId}/channels/${channelId}/sandbox`;

    const automations = `${API}/workspaces/${workspaceId}/automations`;
    const guide = await owner
      .post(automations)
      .send(
        automationInput(channelId, {
          keywords: ['LINK'],
          response: {
            publicReply: { enabled: true, variants: ['Sent you a DM, {username}!'] },
            message: {
              text: 'Here is the guide',
              buttons: [{ label: 'Open guide', url: 'https://example.com/guide' }],
            },
          },
        }),
      )
      .expect(201);
    guideAutomationId = guide.body.id as string;

    await owner
      .post(automations)
      .send(
        automationInput(channelId, {
          name: 'Followers only',
          keywords: ['GATE'],
          response: {
            message: {
              text: 'Thanks for following',
              buttons: [{ label: 'Open', url: 'https://example.com/vip' }],
            },
            followGate: {
              enabled: true,
              text: 'Follow us, then tap below',
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

  async function comment(username: string, text: string): Promise<string> {
    const response = await owner
      .post(`${sandbox}/events`)
      .send({ kind: 'comment', username, text })
      .expect(202);
    return response.body.eventId as string;
  }

  /** Waits until the worker has finished with an inbound event, whatever the outcome. */
  function processed(eventId: string) {
    return waitFor(async () => {
      const event = await t.prisma.inboundEvent.findUniqueOrThrow({ where: { id: eventId } });
      return event.status === 'PROCESSED' || event.status === 'IGNORED' || event.status === 'FAILED'
        ? event
        : null;
    }, `inbound event ${eventId}`);
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
    return response.body as SandboxOutboxEntry[];
  }

  it('notes when an event for the account last arrived, for the channels page', async () => {
    const workspaceId = await firstWorkspaceId(owner);
    const before = await owner.get(`${API}/workspaces/${workspaceId}/channels`).expect(200);
    expect(before.body[0]).toMatchObject({ id: channelId, lastEventAt: null });

    await processed(await comment('nobody', 'just saying hi'));
    const after = await owner.get(`${API}/workspaces/${workspaceId}/channels`).expect(200);
    expect(Date.parse(after.body[0].lastEventAt as string)).toBeGreaterThan(Date.now() - 60_000);
  });

  it('answers a matching comment with a private reply carrying a tracked link, and a public reply', async () => {
    const eventId = await comment('alice', 'Send me the LINK please');
    const delivery = await deliveryFor('alice', 'SENT');
    expect(delivery).toMatchObject({ automationId: guideAutomationId, matchedKeyword: 'LINK' });
    expect((await processed(eventId)).status).toBe('PROCESSED');

    const entries = await waitFor(async () => {
      const all = (await outbox()).filter(
        (entry) => entry.commentId === delivery.triggerExternalId,
      );
      return all.length >= 2 ? all : null;
    }, 'the private and public replies');

    const privateReply = entries.find((entry) => entry.kind === 'private_reply')!;
    expect(privateReply.recipient).toBe(sandboxUserId('alice'));
    expect(privateReply.message.text).toBe('Here is the guide');
    const button = privateReply.message.buttons?.[0];
    expect(button).toMatchObject({ type: 'url', label: 'Open guide' });
    const url = new URL((button as { url: string }).url);
    expect(url.origin).toBe(APP_URL);
    expect(url.pathname).toMatch(/^\/l\/[A-Za-z0-9]{9}$/);
    expect(url.searchParams.get('r')).toMatch(new RegExp(`^${delivery.id}\\.`));

    // Following the link attributes the click to this delivery.
    const click = await request(t.app.getHttpServer() as Parameters<typeof request>[0])
      .get(`${url.pathname}${url.search}`)
      .expect(302);
    expect(click.headers.location).toBe('https://example.com/guide');
    expect(await t.prisma.linkClick.count({ where: { deliveryId: delivery.id } })).toBe(1);

    const publicReply = entries.find((entry) => entry.kind === 'public_reply')!;
    expect(publicReply.message.text).toBe('Sent you a DM, @alice!');
    const stored = await t.prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(stored.publicReplySentAt).not.toBeNull();
  });

  it('ignores a comment that matches no automation', async () => {
    const eventId = await comment('bruno', 'Nice photo!');
    expect((await processed(eventId)).status).toBe('IGNORED');
    expect(
      await t.prisma.delivery.count({ where: { contact: { externalId: sandboxUserId('bruno') } } }),
    ).toBe(0);
    // The contact is still recorded.
    expect(await t.prisma.contact.count({ where: { externalId: sandboxUserId('bruno') } })).toBe(1);
  });

  it('answers a redelivered webhook only once', async () => {
    const channel = await t.prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
    const payload = buildCommentPayload({
      accountId: channel.externalId,
      commentId: 'redelivered-comment-1',
      username: 'carla',
      text: 'LINK',
      mediaId: `${channel.id}-post-1`,
    });
    const ingestor = t.app.get(InboundEventIngestor);
    const first = await ingestor.ingest('INSTAGRAM', payload);
    const second = await ingestor.ingest('INSTAGRAM', payload);
    expect(first.eventId).not.toBe(second.eventId);

    await Promise.all([processed(first.eventId), processed(second.eventId)]);
    await deliveryFor('carla', 'SENT');
    expect(
      await t.prisma.delivery.count({ where: { triggerExternalId: 'redelivered-comment-1' } }),
    ).toBe(1);
    const sends = (await outbox()).filter(
      (entry) => entry.commentId === 'redelivered-comment-1' && entry.kind === 'private_reply',
    );
    expect(sends).toHaveLength(1);
  });

  it('answers each contact once per automation', async () => {
    const eventId = await comment('alice', 'LINK again?');
    expect((await processed(eventId)).status).toBe('IGNORED');
    expect(
      await t.prisma.delivery.count({
        where: { automationId: guideAutomationId, contact: { externalId: sandboxUserId('alice') } },
      }),
    ).toBe(1);
  });

  it('sends gated content after the tap when the contact follows', async () => {
    await comment('dana', 'GATE');
    const delivery = await deliveryFor('dana', 'AWAITING_TAP');

    const gate = (await outbox()).find((entry) => entry.commentId === delivery.triggerExternalId)!;
    expect(gate).toMatchObject({
      kind: 'private_reply',
      message: { text: 'Follow us, then tap below' },
    });
    expect(gate.message.buttons?.[0]).toMatchObject({ type: 'postback', label: 'I follow' });

    await owner.post(`${sandbox}/taps`).send({ deliveryId: delivery.id }).expect(202);
    const sent = await deliveryFor('dana', 'SENT');
    expect(sent.id).toBe(delivery.id);
    const content = (await outbox()).find(
      (entry) => entry.kind === 'message' && entry.recipient === sandboxUserId('dana'),
    )!;
    expect(content.message.text).toBe('Thanks for following');
    expect(
      (await t.prisma.contact.findFirstOrThrow({ where: { externalId: sandboxUserId('dana') } }))
        .isFollower,
    ).toBe(true);
  });

  it('asks again instead of sending when the contact does not follow', async () => {
    await comment('erin_nofollow', 'GATE');
    const delivery = await deliveryFor('erin_nofollow', 'AWAITING_TAP');

    await owner.post(`${sandbox}/taps`).send({ deliveryId: delivery.id }).expect(202);
    const waiting = await deliveryFor('erin_nofollow', 'AWAITING_FOLLOW');
    expect(waiting).toMatchObject({ id: delivery.id, followPrompts: 1, sentAt: null });

    const messages = (await outbox()).filter(
      (entry) => entry.kind === 'message' && entry.recipient === sandboxUserId('erin_nofollow'),
    );
    expect(messages.map((entry) => entry.message.text)).toEqual(['Follow us, then tap below']);
  });

  it('refuses a tap on an unknown delivery', async () => {
    await owner.post(`${sandbox}/taps`).send({ deliveryId: 'not-a-delivery' }).expect(404);
  });
});
