import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.js';
import type { MailContent } from './templates.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;

  constructor(private readonly config: AppConfig) {
    this.transport = config.env.SMTP_URL ? createTransport(config.env.SMTP_URL) : null;
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  /** Sends a message; returns false instead of throwing so callers can fall back. */
  async send(to: string, content: MailContent): Promise<boolean> {
    if (!this.transport) return false;
    try {
      await this.transport.sendMail({ from: this.config.env.MAIL_FROM, to, ...content });
      return true;
    } catch (error) {
      this.logger.error({ err: error }, 'Mail delivery failed');
      return false;
    }
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
