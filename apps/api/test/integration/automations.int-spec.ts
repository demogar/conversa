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

describe('automations', () => {
  let t: TestApp;
  let owner: Agent;
  let workspaceId: string;
  let channelId: string;
  let base: string;

  beforeAll(async () => {
    t = await createTestApp();
    owner = t.agent();
    await signUp(owner, { name: 'Olivia Owner', email: 'owner@example.com' });
    workspaceId = await firstWorkspaceId(owner);
    channelId = await connectSandboxChannel(owner, workspaceId);
    base = `${API}/workspaces/${workspaceId}/automations`;
  });

  afterAll(async () => {
    await t.close();
  });

  async function expectInvalid(body: object): Promise<Record<string, string[]>> {
    const response = await owner.post(base).send(body).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    return response.body.error.fields as Record<string, string[]>;
  }

  it('reports validation problems by field path', async () => {
    expect(await expectInvalid(automationInput(channelId, { keywords: [] }))).toEqual({
      keywords: ['keywords_required'],
    });

    expect(
      await expectInvalid(automationInput(channelId, { postScope: 'SPECIFIC', mediaIds: [] })),
    ).toEqual({
      mediaIds: ['posts_required'],
    });

    const response = {
      publicReply: { enabled: true, variants: [] },
      message: { text: '   ', buttons: [{ label: 'Open', url: 'javascript:alert(1)' }] },
      followGate: { enabled: true, text: '', buttonLabel: '' },
    };
    expect(await expectInvalid(automationInput(channelId, { response }))).toEqual({
      'response.message.text': ['message_required'],
      'response.message.buttons.0.url': ['invalid_url'],
      'response.followGate.text': ['required'],
      'response.followGate.buttonLabel': ['required'],
      'response.publicReply.variants': ['required'],
    });

    // Public replies only exist under comments.
    expect(await expectInvalid(automationInput(channelId, { triggerType: 'MESSAGE' }))).toEqual({
      'response.publicReply.enabled': ['public_reply_comment_only'],
    });

    expect(await t.prisma.automation.count()).toBe(0);
  });

  it('creates an automation with a tracked link per button and keeps slugs stable on update', async () => {
    const buttons = [
      { label: 'Guide', url: 'https://example.com/guide' },
      { label: 'Shop', url: 'https://example.com/shop' },
    ];
    const created = await owner
      .post(base)
      .send(
        automationInput(channelId, {
          keywords: ['link', 'LINK', 'guide'],
          response: { message: { text: 'Here you go', buttons } },
        }),
      )
      .expect(201);
    const id = created.body.id as string;
    expect(created.body).toMatchObject({
      status: 'ACTIVE',
      triggerType: 'COMMENT',
      keywords: ['link', 'LINK', 'guide'],
      response: {
        message: { text: 'Here you go', buttons },
        publicReply: { enabled: false, variants: [] },
      },
      stats: { triggered: 0, sent: 0, failed: 0, clicks: 0 },
    });

    const before = await t.prisma.trackedLink.findMany({
      where: { automationId: id },
      orderBy: { position: 'asc' },
    });
    expect(before.map((link) => [link.position, link.destinationUrl])).toEqual([
      [0, 'https://example.com/guide'],
      [1, 'https://example.com/shop'],
    ]);
    expect(before.every((link) => /^[A-Za-z0-9]{9}$/.test(link.slug))).toBe(true);

    // Change the first button's destination and drop the second.
    const updated = await owner
      .put(`${base}/${id}`)
      .send({
        ...automationInput(channelId),
        name: 'Renamed',
        response: {
          message: {
            text: 'Updated',
            buttons: [{ label: 'Guide v2', url: 'https://example.com/guide-v2' }],
          },
        },
      })
      .expect(200);
    expect(updated.body).toMatchObject({ name: 'Renamed', status: 'ACTIVE' });

    const after = await t.prisma.trackedLink.findMany({ where: { automationId: id } });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      position: 0,
      slug: before[0]!.slug,
      label: 'Guide v2',
      destinationUrl: 'https://example.com/guide-v2',
    });
  });

  it('pauses, duplicates as a draft and deletes', async () => {
    const created = await owner
      .post(base)
      .send(automationInput(channelId, { name: 'To copy' }))
      .expect(201);
    const id = created.body.id as string;

    const paused = await owner.post(`${base}/${id}/status`).send({ status: 'PAUSED' }).expect(200);
    expect(paused.body.status).toBe('PAUSED');

    const copy = await owner.post(`${base}/${id}/duplicate`).expect(201);
    expect(copy.body).toMatchObject({ name: 'To copy (copy)', status: 'DRAFT' });
    const copyLinks = await t.prisma.trackedLink.findMany({
      where: { automationId: copy.body.id as string },
    });
    const sourceLinks = await t.prisma.trackedLink.findMany({ where: { automationId: id } });
    expect(copyLinks).toHaveLength(1);
    expect(copyLinks[0]!.slug).not.toBe(sourceLinks[0]!.slug);

    await owner.delete(`${base}/${id}`).expect(204);
    await owner.get(`${base}/${id}`).expect(404);
    expect(await t.prisma.trackedLink.count({ where: { automationId: id } })).toBe(0);
  });

  it('refuses to activate an automation whose channel is disconnected', async () => {
    const created = await owner
      .post(base)
      .send(automationInput(channelId, { status: 'DRAFT' }))
      .expect(201);
    const otherChannel = await connectSandboxChannel(owner, workspaceId);
    const onOther = await owner
      .post(base)
      .send(automationInput(otherChannel, { status: 'ACTIVE', keywords: ['other'] }))
      .expect(201);

    await owner.delete(`${API}/workspaces/${workspaceId}/channels/${otherChannel}`).expect(204);
    const paused = await owner.get(`${base}/${onOther.body.id as string}`).expect(200);
    expect(paused.body.status).toBe('PAUSED');
    const activate = await owner
      .post(`${base}/${onOther.body.id as string}/status`)
      .send({ status: 'ACTIVE' })
      .expect(422);
    expect(activate.body.error.code).toBe('CHANNEL_NEEDS_REAUTH');

    await owner
      .post(`${base}/${created.body.id as string}/status`)
      .send({ status: 'ACTIVE' })
      .expect(200);
  });
});
