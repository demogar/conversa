import { Global, Injectable, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import type { MailTestFailure } from '@conversa/shared';
import { createTransport, type Transporter } from 'nodemailer';
import {
  InstanceSettingsService,
  type MailSettings,
} from '../../modules/instance/instance-settings.service.js';
import type { MailContent } from './templates.js';

const TIMEOUT_MS = 10_000;

function buildTransport(mail: MailSettings): Transporter {
  return createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.security === 'tls',
    requireTLS: mail.security === 'starttls',
    ignoreTLS: mail.security === 'none',
    auth: mail.auth ?? undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

/**
 * Sorts a delivery failure into a category the admin area can explain. The
 * server's own message is never passed on: it can echo the username or more.
 */
export function classifyMailError(error: unknown): MailTestFailure {
  const { code, responseCode } = (error ?? {}) as { code?: string; responseCode?: number };
  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534) return 'auth';
  if (code === 'ETLS' || code === 'ESOCKET_TLS') return 'tls';
  if (code === 'ETIMEDOUT' || code === 'ETIMEOUT') return 'timeout';
  if (
    code === 'ECONNECTION' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EDNS' ||
    code === 'ESOCKET'
  )
    return 'connection';
  if (code === 'EENVELOPE' || code === 'EMESSAGE' || (responseCode ?? 0) >= 500) return 'rejected';
  return 'unknown';
}

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private transport: Transporter | null = null;
  private builtFor = -1;

  constructor(private readonly settings: InstanceSettingsService) {}

  onModuleDestroy(): void {
    this.transport?.close();
  }

  get enabled(): boolean {
    return this.settings.mail !== null;
  }

  /** Sends a message; returns false instead of throwing so callers can fall back. */
  async send(to: string, content: MailContent): Promise<boolean> {
    const mail = this.settings.mail;
    const transport = this.current();
    if (!mail || !transport) return false;
    try {
      await transport.sendMail({ from: mail.from, to, ...content });
      return true;
    } catch (error) {
      this.logger.error({ err: error, failure: classifyMailError(error) }, 'Mail delivery failed');
      return false;
    }
  }

  /** Sends a test message with the saved settings and reports why it failed, if it did. */
  async test(to: string, content: MailContent): Promise<MailTestFailure | null> {
    const mail = this.settings.mail;
    if (!mail) return 'unknown';
    const transport = buildTransport(mail);
    try {
      await transport.sendMail({ from: mail.from, to, ...content });
      return null;
    } catch (error) {
      const failure = classifyMailError(error);
      this.logger.warn({ failure }, 'Test mail failed');
      return failure;
    } finally {
      transport.close();
    }
  }

  /** The transport for the settings as they are now, rebuilt after they change. */
  private current(): Transporter | null {
    if (this.builtFor !== this.settings.version) {
      this.transport?.close();
      const mail = this.settings.mail;
      this.transport = mail ? buildTransport(mail) : null;
      this.builtFor = this.settings.version;
    }
    return this.transport;
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
