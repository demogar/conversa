import { Injectable, Logger } from '@nestjs/common';
import type { ChannelType } from '@conversa/shared';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

/** A busy account sends many webhooks a minute; the status needs one write per interval. */
const EVENT_WRITE_INTERVAL_MS = 30_000;

export interface WebhookStatus {
  verifiedAt: Date | null;
  lastEventAt: Date | null;
}

/**
 * Remembers when a platform last reached this installation's webhooks, so the
 * admin area can say whether Meta's side of the setup works. Recording never
 * fails a webhook: a status that lags is better than an event Meta retries.
 */
@Injectable()
export class WebhookStatusService {
  private readonly logger = new Logger(WebhookStatusService.name);
  /** Per process, so each API instance writes at most once per interval. */
  private readonly lastEventWrite = new Map<ChannelType, number>();

  constructor(private readonly prisma: PrismaService) {}

  async recordVerified(type: ChannelType, at = new Date()): Promise<void> {
    await this.write(type, { verifiedAt: at });
  }

  async recordEvent(type: ChannelType, at = new Date()): Promise<void> {
    const last = this.lastEventWrite.get(type);
    if (last !== undefined && at.getTime() - last < EVENT_WRITE_INTERVAL_MS) return;
    this.lastEventWrite.set(type, at.getTime());
    await this.write(type, { lastEventAt: at });
  }

  async get(type: ChannelType): Promise<WebhookStatus> {
    const row = await this.prisma.webhookStatus.findUnique({ where: { channelType: type } });
    return { verifiedAt: row?.verifiedAt ?? null, lastEventAt: row?.lastEventAt ?? null };
  }

  private async write(type: ChannelType, data: Partial<WebhookStatus>): Promise<void> {
    try {
      await this.prisma.webhookStatus.upsert({
        where: { channelType: type },
        create: { channelType: type, ...data },
        update: data,
      });
    } catch (error) {
      this.logger.warn({ err: error, type }, 'Could not record the webhook status');
    }
  }
}
