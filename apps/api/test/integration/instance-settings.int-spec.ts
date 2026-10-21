import { createHmac } from 'node:crypto';
import request from 'supertest';
import { InstagramProvider } from '../../src/modules/channels/instagram/instagram.provider.js';
import {
  type Agent,
  API,
  createTestApp,
  PASSWORD,
  signUp,
  type SignedUpUser,
  type TestApp,
} from './support/app.js';

const SECRETS = {
  smtpPassword: 'smtp-password-never-shown',
  appSecret: 'abcdef0123456789abcdef0123456789',
  verifyToken: 'stored-verify-token-42',
  turnstileSecret: '0x4AAAAAAA-secret-never-shown',
};

const mail = {
  // Nothing listens on port 1, so a test email fails to connect.
  host: '127.0.0.1',
  port: 1,
  security: 'none',
  username: 'mailer@example.com',
  password: SECRETS.smtpPassword,
  fromName: 'Conversa',
  fromAddress: 'no-reply@example.com',
};

/** A Meta `signed_request` for the deauthorize and data deletion callbacks. */
function signedRequest(appSecret: string, userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: userId }),
  ).toString('base64url');
  const signature = createHmac('sha256', appSecret).update(payload).digest('base64url');
  return `${signature}.${payload}`;
}

describe('instance settings', () => {
  let t: TestApp;
  let admin: Agent;
  let member: Agent;
  let adminUser: SignedUpUser;
  let memberUser: SignedUpUser;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer() as Parameters<typeof request>[0];
    admin = t.agent();
    member = t.agent();
    adminUser = await signUp(admin, { name: 'Ada Admin', email: 'admin@example.com' });
  });

  afterAll(async () => {
    await t.close();
  });

  it('makes the first account an instance admin', async () => {
    const me = await admin.get(`${API}/me`).expect(200);
    expect(me.body.user).toMatchObject({ email: 'admin@example.com', isInstanceAdmin: true });
  });

  it('starts invitation-only with mail, captcha and the Meta app off', async () => {
    const instance = await request(server).get(`${API}/instance`).expect(200);
    expect(instance.body).toMatchObject({
      needsSetup: false,
      signupOpen: false,
      mailEnabled: false,
      captchaSiteKey: null,
    });
    const settings = await admin.get(`${API}/instance/settings`).expect(200);
    expect(settings.body).toMatchObject({
      mail: { configured: false, password: { configured: false } },
      instagram: { configured: false },
      turnstile: { configured: false },
      signup: { mode: 'invite_only' },
    });
    expect(settings.body.instagram.urls.webhook).toMatch(/\/api\/v1\/webhooks\/instagram$/);
  });

  it('switches sign-up to open immediately', async () => {
    await admin.patch(`${API}/instance/settings/signup`).send({ mode: 'open' }).expect(200);
    expect((await request(server).get(`${API}/instance`)).body.signupOpen).toBe(true);
    memberUser = await signUp(member, { name: 'Max Member', email: 'member@example.com' });

    await admin.patch(`${API}/instance/settings/signup`).send({ mode: 'invite_only' }).expect(200);
    const closed = await t
      .agent()
      .post(`${API}/auth/signup`)
      .send({ name: 'Late', email: 'late@example.com', password: PASSWORD })
      .expect(403);
    expect(closed.body.error.code).toBe('SIGNUP_CLOSED');
  });

  it('does not make later accounts instance admins, and refuses them every admin route', async () => {
    const me = await member.get(`${API}/me`).expect(200);
    expect(me.body.user.isInstanceAdmin).toBe(false);

    await member.get(`${API}/instance/settings`).expect(403);
    await member.patch(`${API}/instance/settings/signup`).send({ mode: 'open' }).expect(403);
    await member.patch(`${API}/instance/settings/mail`).send(mail).expect(403);
    await member.delete(`${API}/instance/settings/mail`).expect(403);
    await member
      .post(`${API}/instance/settings/mail/test`)
      .send({ to: 'member@example.com' })
      .expect(403);
    await member.get(`${API}/instance/admins`).expect(403);
    await member
      .patch(`${API}/instance/admins/${memberUser.id}`)
      .send({ isInstanceAdmin: true })
      .expect(403);
    await request(server).get(`${API}/instance/settings`).expect(401);
  });

  it('saves mail settings and never returns the password', async () => {
    const saved = await admin.patch(`${API}/instance/settings/mail`).send(mail).expect(200);
    expect(JSON.stringify(saved.body)).not.toContain(SECRETS.smtpPassword);
    expect(saved.body.mail).toMatchObject({
      configured: true,
      host: '127.0.0.1',
      port: 1,
      security: 'none',
      username: 'mailer@example.com',
      password: { configured: true, hint: 'hown' },
    });
    expect((await request(server).get(`${API}/instance`)).body.mailEnabled).toBe(true);

    const row = await t.prisma.instanceSetting.findUniqueOrThrow({ where: { key: 'mail' } });
    expect(row.value).not.toContain(SECRETS.smtpPassword);
    expect(row.updatedById).toBe(adminUser.id);

    // Saving again without the password keeps it.
    await admin
      .patch(`${API}/instance/settings/mail`)
      .send({ ...mail, password: '', port: 2 })
      .expect(200);
    const kept = await admin.get(`${API}/instance/settings`).expect(200);
    expect(kept.body.mail).toMatchObject({ port: 2, password: { configured: true } });
  });

  it('reports a failed test email as a category, without the server message', async () => {
    const response = await admin
      .post(`${API}/instance/settings/mail/test`)
      .send({ to: 'admin@example.com' })
      .expect(200);
    expect(response.body).toEqual({ ok: false, failure: 'connection' });
  });

  it('rejects invalid input with field codes', async () => {
    const response = await admin
      .patch(`${API}/instance/settings/mail`)
      .send({ ...mail, port: 70000, fromAddress: 'not an email' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(response.body.error.fields)).toEqual(
      expect.arrayContaining(['port', 'fromAddress']),
    );
  });

  it('uses the stored Meta app for webhook verification and signed callbacks', async () => {
    const instagram = t.app.get(InstagramProvider);
    const challenge = {
      'hub.mode': 'subscribe',
      'hub.verify_token': SECRETS.verifyToken,
      'hub.challenge': 'challenge-123',
    };
    expect(instagram.isConfigured()).toBe(false);
    expect(instagram.verifySubscription(challenge)).toBeNull();
    await request(server)
      .post(`${API}/webhooks/instagram/deauthorize`)
      .send({ signed_request: signedRequest(SECRETS.appSecret, '17841400000000000') })
      .expect(401);

    const saved = await admin
      .patch(`${API}/instance/settings/instagram`)
      .send({
        appId: '1234567890',
        appSecret: SECRETS.appSecret,
        verifyToken: SECRETS.verifyToken,
      })
      .expect(200);
    const body = JSON.stringify(saved.body);
    expect(body).not.toContain(SECRETS.appSecret);
    expect(body).not.toContain(SECRETS.verifyToken);
    expect(saved.body.instagram).toMatchObject({
      configured: true,
      appId: '1234567890',
      appSecret: { configured: true, hint: '6789' },
      verifyToken: { configured: true, hint: 'n-42' },
    });

    expect(instagram.isConfigured()).toBe(true);
    expect(instagram.verifySubscription(challenge)).toBe('challenge-123');
    expect(instagram.verifySubscription({ ...challenge, 'hub.verify_token': 'wrong' })).toBeNull();
    const payload = Buffer.from('{"object":"instagram","entry":[]}');
    const signature = `sha256=${createHmac('sha256', SECRETS.appSecret).update(payload).digest('hex')}`;
    expect(instagram.verifySignature(payload, { 'x-hub-signature-256': signature })).toBe(true);

    await request(server)
      .post(`${API}/webhooks/instagram/deauthorize`)
      .send({ signed_request: signedRequest(SECRETS.appSecret, '17841400000000000') })
      .expect(200);
    await request(server)
      .post(`${API}/webhooks/instagram/deauthorize`)
      .send({ signed_request: signedRequest('some-other-secret', '17841400000000000') })
      .expect(401);
  });

  it('publishes the Turnstile site key but never the secret', async () => {
    await admin
      .patch(`${API}/instance/settings/turnstile`)
      .send({ siteKey: '0x4AAAAAAA-site', secretKey: SECRETS.turnstileSecret })
      .expect(200);
    const instance = await request(server).get(`${API}/instance`).expect(200);
    expect(instance.body.captchaSiteKey).toBe('0x4AAAAAAA-site');
    expect(JSON.stringify(instance.body)).not.toContain(SECRETS.turnstileSecret);

    // With Turnstile on, signing in needs a token.
    const refused = await t
      .agent()
      .post(`${API}/auth/login`)
      .send({ email: 'admin@example.com', password: PASSWORD })
      .expect(403);
    expect(refused.body.error.code).toBe('CAPTCHA_FAILED');

    await admin.delete(`${API}/instance/settings/turnstile`).expect(200);
    expect((await request(server).get(`${API}/instance`)).body.captchaSiteKey).toBeNull();
  });

  it('clears a section and answers 404 for an unknown one', async () => {
    await admin.delete(`${API}/instance/settings/mail`).expect(200);
    expect((await request(server).get(`${API}/instance`)).body.mailEnabled).toBe(false);
    const refused = await admin
      .post(`${API}/instance/settings/mail/test`)
      .send({ to: 'admin@example.com' })
      .expect(503);
    expect(refused.body.error.code).toBe('MAIL_NOT_CONFIGURED');
    await admin.delete(`${API}/instance/settings/everything`).expect(404);
  });

  it('grants and revokes instance admin, but never removes the last one', async () => {
    const list = await admin.get(`${API}/instance/admins`).expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: adminUser.id, isInstanceAdmin: true }),
      expect.objectContaining({ id: memberUser.id, isInstanceAdmin: false }),
    ]);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');

    const last = await admin
      .patch(`${API}/instance/admins/${adminUser.id}`)
      .send({ isInstanceAdmin: false })
      .expect(409);
    expect(last.body.error.code).toBe('LAST_INSTANCE_ADMIN');

    await admin
      .patch(`${API}/instance/admins/${memberUser.id}`)
      .send({ isInstanceAdmin: true })
      .expect(200);
    await member.get(`${API}/instance/settings`).expect(200);

    await member
      .patch(`${API}/instance/admins/${adminUser.id}`)
      .send({ isInstanceAdmin: false })
      .expect(200);
    await admin.get(`${API}/instance/settings`).expect(403);
    await member
      .patch(`${API}/instance/admins/unknown-user`)
      .send({ isInstanceAdmin: true })
      .expect(404);
  });

  it('audits every change by section, without values', async () => {
    const entries = await t.prisma.auditLog.findMany({
      where: { action: { startsWith: 'instance.' } },
    });
    const actions = entries.map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'instance.settings_updated',
        'instance.admin_granted',
        'instance.admin_revoked',
      ]),
    );
    const serialized = JSON.stringify(entries);
    for (const secret of Object.values(SECRETS)) expect(serialized).not.toContain(secret);
    expect(entries.map((entry) => entry.targetId)).toEqual(
      expect.arrayContaining(['mail', 'instagram', 'turnstile', 'signup']),
    );
  });
});
