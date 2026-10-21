import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import {
  updateInstagramSettingsSchema,
  updateMailSettingsSchema,
  updateTurnstileSettingsSchema,
} from '@conversa/shared';
import type { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';
import type { Env } from '../../config/env.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuditService } from '../audit/audit.service.js';
import { InstanceSettingsService } from './instance-settings.service.js';

interface Row {
  key: string;
  value: string;
  updatedById: string | null;
}

/** A database table and a Redis pub/sub bus shared by several "processes". */
function world() {
  const rows = new Map<string, Row>();
  const bus = new EventEmitter();
  const prisma = {
    instanceSetting: {
      findMany: async () => [...rows.values()],
      findUnique: async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { key: string };
        create: Row;
        update: Partial<Row>;
      }) => {
        const existing = rows.get(where.key);
        rows.set(where.key, existing ? { ...existing, ...update } : create);
      },
      update: async ({ where, data }: { where: { key: string }; data: Partial<Row> }) => {
        rows.set(where.key, { ...rows.get(where.key)!, ...data });
      },
      deleteMany: async ({ where }: { where: { key: string } }) => {
        rows.delete(where.key);
      },
    },
  } as unknown as PrismaService;
  const env = {
    SECRET_KEY: 'x'.repeat(48),
    ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    ENCRYPTION_KEYS_PREVIOUS: [],
    APP_URL: 'https://conversa.example.com',
    INSTAGRAM_SANDBOX: false,
  } as unknown as Env;
  const config = new AppConfig(env);
  const crypto = new CryptoService(config);
  const audit = {
    calls: [] as unknown[],
    async record(event: unknown) {
      this.calls.push(event);
    },
  };

  function redis(): Redis {
    return {
      publish: async (channel: string, message: string) => {
        bus.emit('publish', channel, message);
        return 1;
      },
      duplicate: () => {
        const subscriber = new EventEmitter() as EventEmitter & Record<string, unknown>;
        subscriber.subscribe = async (channel: string) => {
          bus.on('publish', (published: string, message: string) => {
            if (published === channel) subscriber.emit('message', channel, message);
          });
        };
        subscriber.quit = async () => 'OK';
        return subscriber;
      },
    } as unknown as Redis;
  }

  async function process(): Promise<InstanceSettingsService> {
    const service = new InstanceSettingsService(
      prisma,
      crypto,
      config,
      audit as unknown as AuditService,
      redis(),
    );
    await service.onModuleInit();
    return service;
  }

  return { rows, process, audit };
}

/** Lets the subscriber's reload, started from an event, finish. */
const settle = () => new Promise((done) => setImmediate(done));

const mailInput = (overrides: Record<string, unknown> = {}) =>
  updateMailSettingsSchema.parse({
    host: 'smtp.example.com',
    port: 587,
    security: 'starttls',
    username: 'mailer@example.com',
    password: 'smtp-password-1234',
    fromName: 'Conversa',
    fromAddress: 'no-reply@example.com',
    ...overrides,
  });

describe('InstanceSettingsService', () => {
  it('starts with nothing configured and sign-up by invitation', async () => {
    const settings = await world().process();
    expect(settings.mail).toBeNull();
    expect(settings.instagram).toBeNull();
    expect(settings.turnstile).toBeNull();
    expect(settings.signupMode).toBe('invite_only');
  });

  it('stores every section encrypted, secrets included', async () => {
    const { rows, process } = world();
    const settings = await process();
    await settings.update('mail', mailInput(), 'admin-1');

    const row = rows.get('mail')!;
    expect(row.value).not.toContain('smtp-password-1234');
    expect(row.value).not.toContain('smtp.example.com');
    expect(row.updatedById).toBe('admin-1');
    expect(settings.mail).toEqual({
      host: 'smtp.example.com',
      port: 587,
      security: 'starttls',
      auth: { user: 'mailer@example.com', pass: 'smtp-password-1234' },
      from: { name: 'Conversa', address: 'no-reply@example.com' },
    });
  });

  it('keeps a stored secret when the field is left out or empty, and clears it on null', async () => {
    const settings = await world().process();
    await settings.update('mail', mailInput(), 'admin-1');

    await settings.update('mail', mailInput({ password: undefined, port: 2525 }), 'admin-1');
    expect(settings.mail?.auth?.pass).toBe('smtp-password-1234');
    expect(settings.mail?.port).toBe(2525);

    await settings.update('mail', mailInput({ password: '' }), 'admin-1');
    expect(settings.mail?.auth?.pass).toBe('smtp-password-1234');

    await settings.update('mail', mailInput({ password: null, username: '' }), 'admin-1');
    expect(settings.mail?.auth).toBeNull();
    expect(settings.toDto().mail.password).toEqual({ configured: false, hint: null });
  });

  it('never puts a secret in the DTO, only whether it is set and its last characters', async () => {
    const settings = await world().process();
    await settings.update('mail', mailInput(), 'admin-1');
    await settings.update(
      'instagram',
      updateInstagramSettingsSchema.parse({
        appId: '1234567890',
        appSecret: 'abcdef0123456789abcdef0123456789',
        verifyToken: 'short-token',
      }),
      'admin-1',
    );
    await settings.update(
      'turnstile',
      updateTurnstileSettingsSchema.parse({
        siteKey: '0x4AAAA-site',
        secretKey: '0x4AAAA-secret-key-9876',
      }),
      'admin-1',
    );

    const dto = settings.toDto();
    const serialized = JSON.stringify(dto);
    for (const secret of [
      'smtp-password-1234',
      'abcdef0123456789abcdef0123456789',
      'short-token',
      '0x4AAAA-secret-key-9876',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(dto.mail.password).toEqual({ configured: true, hint: '1234' });
    expect(dto.instagram.appSecret).toEqual({ configured: true, hint: '6789' });
    // Too short to reveal four characters of.
    expect(dto.instagram.verifyToken).toEqual({ configured: true, hint: null });
    expect(dto.turnstile).toMatchObject({ configured: true, siteKey: '0x4AAAA-site' });
    expect(dto.instagram.urls).toEqual({
      oauthRedirect: 'https://conversa.example.com/api/v1/channels/oauth/instagram/callback',
      webhook: 'https://conversa.example.com/api/v1/webhooks/instagram',
      deauthorize: 'https://conversa.example.com/api/v1/webhooks/instagram/deauthorize',
      dataDeletion: 'https://conversa.example.com/api/v1/webhooks/instagram/data-deletion',
      privacyPolicy: 'https://conversa.example.com/legal/privacy',
      termsOfService: 'https://conversa.example.com/legal/terms',
    });
  });

  it('treats the Instagram app as configured only with all three values', async () => {
    const settings = await world().process();
    await settings.update(
      'instagram',
      updateInstagramSettingsSchema.parse({ appId: '1234567890', appSecret: 'app-secret' }),
      'admin-1',
    );
    expect(settings.instagram).toBeNull();
    await settings.update(
      'instagram',
      updateInstagramSettingsSchema.parse({ appId: '1234567890', verifyToken: 'verify-token-1' }),
      'admin-1',
    );
    expect(settings.instagram).toEqual({
      appId: '1234567890',
      appSecret: 'app-secret',
      verifyToken: 'verify-token-1',
    });
  });

  it('tells every other process to reload after a change', async () => {
    const { process } = world();
    const api = await process();
    const worker = await process();
    const versionBefore = worker.version;

    await api.update('signup', { mode: 'open' }, 'admin-1');
    await settle();
    expect(worker.signupMode).toBe('open');
    expect(worker.version).toBeGreaterThan(versionBefore);

    await api.update('mail', mailInput(), 'admin-1');
    await settle();
    expect(worker.mail?.host).toBe('smtp.example.com');

    await api.clear('mail', 'admin-1');
    await settle();
    expect(worker.mail).toBeNull();
  });

  it('records the section in the audit log, never the values', async () => {
    const { process, audit } = world();
    const settings = await process();
    await settings.update('mail', mailInput(), 'admin-1', '203.0.113.7');
    expect(audit.calls).toContainEqual(
      expect.objectContaining({
        action: 'instance.settings_updated',
        actorId: 'admin-1',
        targetId: 'mail',
        metadata: { section: 'mail' },
      }),
    );
    expect(JSON.stringify(audit.calls)).not.toContain('smtp-password-1234');
  });

  it('acts as unset when a section cannot be decrypted', async () => {
    const { rows, process } = world();
    rows.set('signup', { key: 'signup', value: 'v1.deadbeef.garbage', updatedById: null });
    const settings = await process();
    expect(settings.signupMode).toBe('invite_only');
  });
});
