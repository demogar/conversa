import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type {
  InstanceSettingsDto,
  InstanceSettingsSection,
  MailSecurity,
  SecretStatusDto,
  SignupMode,
  UpdateInstagramSettingsInput,
  UpdateMailSettingsInput,
  UpdateSignupSettingsInput,
  UpdateTikTokSettingsInput,
  UpdateTurnstileSettingsInput,
} from '@conversa/shared';
import { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';
import { AuditService } from '../audit/audit.service.js';

/** Every API process and worker listens here and reloads when a section changes. */
export const SETTINGS_CHANNEL = 'conversa:instance-settings';

/** Secrets shorter than this get no hint: four characters would give too much away. */
const HINT_MIN_LENGTH = 12;

// What each section's row holds, decrypted. Secrets are null when not set.
interface StoredMail {
  host: string;
  port: number;
  security: MailSecurity;
  username: string | null;
  password: string | null;
  fromName: string;
  fromAddress: string;
}
interface StoredInstagram {
  appId: string;
  appSecret: string | null;
  verifyToken: string | null;
}
interface StoredTikTok {
  appId: string;
  appSecret: string | null;
  authorizationUrl: string;
}
interface StoredTurnstile {
  siteKey: string;
  secretKey: string | null;
}
interface StoredSignup {
  mode: SignupMode;
}
interface Stored {
  mail?: StoredMail;
  instagram?: StoredInstagram;
  tiktok?: StoredTikTok;
  turnstile?: StoredTurnstile;
  signup?: StoredSignup;
}

export interface MailSettings {
  host: string;
  port: number;
  security: MailSecurity;
  auth: { user: string; pass: string } | null;
  from: { name: string; address: string };
}

export interface InstagramAppSettings {
  appId: string;
  appSecret: string;
  verifyToken: string;
}

export interface TikTokAppSettings {
  appId: string;
  appSecret: string;
  authorizationUrl: string;
}

export interface TurnstileSettings {
  siteKey: string;
  secretKey: string;
}

export type SectionInput = {
  mail: UpdateMailSettingsInput;
  instagram: UpdateInstagramSettingsInput;
  tiktok: UpdateTikTokSettingsInput;
  turnstile: UpdateTurnstileSettingsInput;
  signup: UpdateSignupSettingsInput;
};

/** A secret from an update: undefined keeps the stored value, null clears it. */
function merge(next: string | null | undefined, stored: string | null | undefined): string | null {
  return next === undefined ? (stored ?? null) : next;
}

export function secretStatus(value: string | null | undefined): SecretStatusDto {
  if (!value) return { configured: false, hint: null };
  return { configured: true, hint: value.length >= HINT_MIN_LENGTH ? value.slice(-4) : null };
}

/**
 * Installation-wide settings (mail, the Meta and TikTok apps, Turnstile, sign-up mode),
 * edited in the admin area and stored encrypted in `InstanceSetting`.
 *
 * Reads are synchronous from an in-memory copy, so hot paths (webhook
 * signatures, sign-in) never wait on the database. A write reloads the copy
 * here and publishes on SETTINGS_CHANNEL so every other API process and
 * worker reloads too.
 */
@Injectable()
export class InstanceSettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InstanceSettingsService.name);
  private stored: Stored = {};
  private subscriber: Redis | null = null;
  private loadedVersion = 0;
  private reloadsStarted = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
    this.subscriber = this.redis.duplicate();
    this.subscriber.on('message', (channel: string) => {
      if (channel === SETTINGS_CHANNEL) void this.reload();
    });
    // After a reconnect a change may have been missed while disconnected.
    this.subscriber.on('ready', () => void this.reload());
    await this.subscriber.subscribe(SETTINGS_CHANNEL);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }

  /** Grows on every reload, so holders of derived state (the mail transport) know to rebuild. */
  get version(): number {
    return this.loadedVersion;
  }

  get mail(): MailSettings | null {
    const mail = this.stored.mail;
    if (!mail) return null;
    return {
      host: mail.host,
      port: mail.port,
      security: mail.security,
      auth: mail.username ? { user: mail.username, pass: mail.password ?? '' } : null,
      from: { name: mail.fromName || 'Conversa', address: mail.fromAddress },
    };
  }

  get instagram(): InstagramAppSettings | null {
    const app = this.stored.instagram;
    if (!app?.appId || !app.appSecret || !app.verifyToken) return null;
    return { appId: app.appId, appSecret: app.appSecret, verifyToken: app.verifyToken };
  }

  get tiktok(): TikTokAppSettings | null {
    const app = this.stored.tiktok;
    if (!app?.appId || !app.appSecret || !app.authorizationUrl) return null;
    return { appId: app.appId, appSecret: app.appSecret, authorizationUrl: app.authorizationUrl };
  }

  get turnstile(): TurnstileSettings | null {
    const turnstile = this.stored.turnstile;
    if (!turnstile?.siteKey || !turnstile.secretKey) return null;
    return { siteKey: turnstile.siteKey, secretKey: turnstile.secretKey };
  }

  /** Invitation only until an admin opens sign-up. */
  get signupMode(): SignupMode {
    return this.stored.signup?.mode ?? 'invite_only';
  }

  /** What the admin area shows: every value except the secrets themselves. */
  toDto(): InstanceSettingsDto {
    const { mail, instagram, tiktok, turnstile } = this.stored;
    return {
      mail: {
        configured: this.mail !== null,
        host: mail?.host ?? null,
        port: mail?.port ?? null,
        security: mail?.security ?? 'starttls',
        username: mail?.username ?? null,
        password: secretStatus(mail?.password),
        fromName: mail?.fromName ?? '',
        fromAddress: mail?.fromAddress ?? null,
      },
      instagram: {
        configured: this.instagram !== null,
        appId: instagram?.appId ?? null,
        appSecret: secretStatus(instagram?.appSecret),
        verifyToken: secretStatus(instagram?.verifyToken),
        urls: {
          oauthRedirect: this.config.url('/api/v1/channels/oauth/instagram/callback'),
          webhook: this.config.url('/api/v1/webhooks/instagram'),
          deauthorize: this.config.url('/api/v1/webhooks/instagram/deauthorize'),
          dataDeletion: this.config.url('/api/v1/webhooks/instagram/data-deletion'),
          privacyPolicy: this.config.url('/legal/privacy'),
          termsOfService: this.config.url('/legal/terms'),
        },
      },
      tiktok: {
        configured: this.tiktok !== null,
        appId: tiktok?.appId ?? null,
        appSecret: secretStatus(tiktok?.appSecret),
        authorizationUrl: tiktok?.authorizationUrl ?? null,
        urls: {
          // TikTok accepts only redirect URLs that end in a slash.
          oauthRedirect: this.config.url('/api/v1/channels/oauth/tiktok/callback/'),
          webhook: this.config.url('/api/v1/webhooks/tiktok'),
        },
      },
      turnstile: {
        configured: this.turnstile !== null,
        siteKey: turnstile?.siteKey ?? null,
        secretKey: secretStatus(turnstile?.secretKey),
      },
      signup: { mode: this.signupMode },
      sandbox: this.config.sandbox,
    };
  }

  async update<S extends InstanceSettingsSection>(
    section: S,
    input: SectionInput[S],
    actorId: string,
    ip?: string,
  ): Promise<void> {
    // Merged with the row as stored now, not the cached copy, so a secret
    // kept by one admin is not lost to another admin's concurrent save.
    const current = await this.readSection(section);
    await this.write(section, this.mergeSection(section, input, current), actorId);
    await this.audit.record({
      action: 'instance.settings_updated',
      actorId,
      targetType: 'instance_settings',
      targetId: section,
      ip,
      metadata: { section },
    });
  }

  /** Removes a section, turning the feature off (mail, Meta or TikTok app, captcha). */
  async clear(section: InstanceSettingsSection, actorId: string, ip?: string): Promise<void> {
    await this.prisma.instanceSetting.deleteMany({ where: { key: section } });
    await this.changed();
    await this.audit.record({
      action: 'instance.settings_updated',
      actorId,
      targetType: 'instance_settings',
      targetId: section,
      ip,
      metadata: { section, cleared: true },
    });
  }

  /** Reads every section from the database into the in-memory copy. */
  async reload(): Promise<void> {
    const started = ++this.reloadsStarted;
    const rows = await this.prisma.instanceSetting.findMany();
    // A slower, older reload must not overwrite what a newer one read.
    if (started !== this.reloadsStarted) return;
    const next: Stored = {};
    for (const row of rows) {
      try {
        (next as Record<string, unknown>)[row.key] = this.crypto.decryptJson(row.value);
      } catch (error) {
        // An unreadable section (an encryption key removed too early) acts as
        // unset rather than taking the whole instance down.
        this.logger.error({ err: error, section: row.key }, 'Instance setting cannot be decrypted');
      }
    }
    this.stored = next;
    this.loadedVersion += 1;
  }

  /** Re-encrypts sections written with a previous ENCRYPTION_KEY (maintenance). */
  async reencrypt(): Promise<number> {
    const rows = await this.prisma.instanceSetting.findMany();
    let count = 0;
    for (const row of rows) {
      if (!this.crypto.needsReencryption(row.value)) continue;
      try {
        const value = this.crypto.encrypt(this.crypto.decrypt(row.value));
        await this.prisma.instanceSetting.update({ where: { key: row.key }, data: { value } });
        count += 1;
      } catch (error) {
        this.logger.error({ err: error, section: row.key }, 'Instance setting cannot be decrypted');
      }
    }
    return count;
  }

  private mergeSection<S extends InstanceSettingsSection>(
    section: S,
    input: SectionInput[S],
    current: Stored[S] | undefined,
  ): Stored[S] {
    switch (section) {
      case 'mail': {
        const mail = input as UpdateMailSettingsInput;
        const stored = current as StoredMail | undefined;
        return {
          host: mail.host,
          port: mail.port,
          security: mail.security,
          username: mail.username || null,
          password: merge(mail.password, stored?.password),
          fromName: mail.fromName,
          fromAddress: mail.fromAddress,
        } satisfies StoredMail as Stored[S];
      }
      case 'instagram': {
        const app = input as UpdateInstagramSettingsInput;
        const stored = current as StoredInstagram | undefined;
        return {
          appId: app.appId,
          appSecret: merge(app.appSecret, stored?.appSecret),
          verifyToken: merge(app.verifyToken, stored?.verifyToken),
        } satisfies StoredInstagram as Stored[S];
      }
      case 'tiktok': {
        const app = input as UpdateTikTokSettingsInput;
        const stored = current as StoredTikTok | undefined;
        return {
          appId: app.appId,
          appSecret: merge(app.appSecret, stored?.appSecret),
          authorizationUrl: app.authorizationUrl,
        } satisfies StoredTikTok as Stored[S];
      }
      case 'turnstile': {
        const turnstile = input as UpdateTurnstileSettingsInput;
        const stored = current as StoredTurnstile | undefined;
        return {
          siteKey: turnstile.siteKey,
          secretKey: merge(turnstile.secretKey, stored?.secretKey),
        } satisfies StoredTurnstile as Stored[S];
      }
      default:
        return {
          mode: (input as UpdateSignupSettingsInput).mode,
        } satisfies StoredSignup as Stored[S];
    }
  }

  private async readSection<S extends InstanceSettingsSection>(
    section: S,
  ): Promise<Stored[S] | undefined> {
    const row = await this.prisma.instanceSetting.findUnique({ where: { key: section } });
    if (!row) return undefined;
    try {
      return this.crypto.decryptJson<Stored[S]>(row.value);
    } catch {
      return undefined;
    }
  }

  private async write(section: InstanceSettingsSection, value: unknown, actorId: string) {
    const encrypted = this.crypto.encryptJson(value);
    await this.prisma.instanceSetting.upsert({
      where: { key: section },
      create: { key: section, value: encrypted, updatedById: actorId },
      update: { value: encrypted, updatedById: actorId },
    });
    await this.changed();
  }

  private async changed(): Promise<void> {
    await this.reload();
    try {
      await this.redis.publish(SETTINGS_CHANNEL, 'changed');
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not announce an instance settings change');
    }
  }
}
