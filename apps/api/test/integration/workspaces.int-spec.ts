import {
  type Agent,
  API,
  automationInput,
  connectSandboxChannel,
  createTestApp,
  firstWorkspaceId,
  signUp,
  type SignedUpUser,
  type TestApp,
} from './support/app.js';

/** The token at the end of an invitation's accept URL. */
function tokenOf(acceptUrl: string): string {
  const token = new URL(acceptUrl).pathname.split('/').pop();
  if (!token) throw new Error(`No token in ${acceptUrl}`);
  return token;
}

describe('workspaces', () => {
  let t: TestApp;
  let owner: Agent;
  let admin: Agent;
  let member: Agent;
  let ownerUser: SignedUpUser;
  let memberUser: SignedUpUser;
  let workspaceId: string;

  beforeAll(async () => {
    t = await createTestApp();
    owner = t.agent();
    admin = t.agent();
    member = t.agent();
    ownerUser = await signUp(owner, { name: 'Olivia Owner', email: 'owner@example.com' });
    workspaceId = await firstWorkspaceId(owner);
  });

  afterAll(async () => {
    await t.close();
  });

  it('lets an invitee sign up into the inviting workspace with the invited role', async () => {
    const invited = await owner
      .post(`${API}/workspaces/${workspaceId}/invitations`)
      .send({ email: 'admin@example.com', role: 'ADMIN' })
      .expect(201);
    expect(invited.body).toMatchObject({
      email: 'admin@example.com',
      role: 'ADMIN',
      emailed: false,
    });

    const token = tokenOf(invited.body.acceptUrl as string);
    const preview = await t.agent().get(`${API}/invitations/${token}`).expect(200);
    expect(preview.body).toMatchObject({
      email: 'admin@example.com',
      role: 'ADMIN',
      workspaceName: "Olivia Owner's workspace",
    });

    await signUp(admin, { name: 'Ada Admin', email: 'admin@example.com', invitationToken: token });
    const workspaces = await admin.get(`${API}/workspaces`).expect(200);
    // Joining by invitation creates no workspace of its own.
    expect(workspaces.body).toEqual([expect.objectContaining({ id: workspaceId, role: 'ADMIN' })]);

    // The invitation cannot be used twice.
    const reused = await t
      .agent()
      .post(`${API}/auth/signup`)
      .send({
        name: 'Again',
        email: 'admin@example.com',
        password: 'another long password',
        invitationToken: token,
      })
      .expect(400);
    expect(reused.body.error.code).toBe('TOKEN_INVALID');
  });

  it('lets an admin invite a member, who joins as MEMBER', async () => {
    const invited = await admin
      .post(`${API}/workspaces/${workspaceId}/invitations`)
      .send({ email: 'member@example.com', role: 'MEMBER' })
      .expect(201);
    memberUser = await signUp(member, {
      name: 'Max Member',
      email: 'member@example.com',
      invitationToken: tokenOf(invited.body.acceptUrl as string),
    });

    const membership = await t.prisma.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId, userId: memberUser.id } },
    });
    expect(membership.role).toBe('MEMBER');

    const members = await member.get(`${API}/workspaces/${workspaceId}/members`).expect(200);
    expect((members.body as Array<{ role: string }>).map((m) => m.role).sort()).toEqual([
      'ADMIN',
      'MEMBER',
      'OWNER',
    ]);
  });

  it('refuses invitations with a mismatched email', async () => {
    const invited = await owner
      .post(`${API}/workspaces/${workspaceId}/invitations`)
      .send({ email: 'someone@example.com', role: 'MEMBER' })
      .expect(201);
    const response = await t
      .agent()
      .post(`${API}/auth/signup`)
      .send({
        name: 'Impostor',
        email: 'impostor@example.com',
        password: 'another long password',
        invitationToken: tokenOf(invited.body.acceptUrl as string),
      })
      .expect(403);
    expect(response.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');
  });

  it('does not let a member invite or manage the workspace', async () => {
    const invite = await member
      .post(`${API}/workspaces/${workspaceId}/invitations`)
      .send({ email: 'friend@example.com', role: 'MEMBER' })
      .expect(403);
    expect(invite.body.error.code).toBe('FORBIDDEN');

    await member.patch(`${API}/workspaces/${workspaceId}`).send({ name: 'Taken over' }).expect(403);
    const remove = await member
      .delete(`${API}/workspaces/${workspaceId}/members/${ownerUser.id}`)
      .expect(403);
    expect(remove.body.error.code).toBe('FORBIDDEN');
  });

  it('hides other workspaces entirely (404, not 403)', async () => {
    const created = await member
      .post(`${API}/workspaces`)
      .send({ name: 'Side project' })
      .expect(201);
    const otherId = created.body.id as string;
    const channelId = await connectSandboxChannel(member, otherId);
    await member
      .post(`${API}/workspaces/${otherId}/automations`)
      .send(automationInput(channelId))
      .expect(201);

    for (const path of ['members', 'automations', 'channels']) {
      const response = await owner.get(`${API}/workspaces/${otherId}/${path}`).expect(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
    await owner
      .post(`${API}/workspaces/${otherId}/automations`)
      .send(automationInput(channelId))
      .expect(404);
    await owner.get(`${API}/workspaces/does-not-exist/automations`).expect(404);

    // A channel from another workspace cannot be used by id either.
    const borrowed = await owner
      .post(`${API}/workspaces/${workspaceId}/automations`)
      .send(automationInput(channelId))
      .expect(400);
    expect(borrowed.body.error.fields).toEqual({ channelId: ['not_found'] });
  });

  it('keeps at least one owner', async () => {
    const leave = await owner
      .delete(`${API}/workspaces/${workspaceId}/members/${ownerUser.id}`)
      .expect(409);
    expect(leave.body.error.code).toBe('LAST_OWNER');

    const demote = await owner
      .patch(`${API}/workspaces/${workspaceId}/members/${ownerUser.id}`)
      .send({ role: 'ADMIN' })
      .expect(409);
    expect(demote.body.error.code).toBe('LAST_OWNER');

    // A member may still leave.
    await member.delete(`${API}/workspaces/${workspaceId}/members/${memberUser.id}`).expect(204);
    await member.get(`${API}/workspaces/${workspaceId}/members`).expect(404);
  });
});
