import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { ChannelType } from '@conversa/shared';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { INBOUND_QUEUE, type InboundJob } from '../../infra/queue/queues.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Stores a webhook payload and queues it for the worker. Real webhooks and
 * the sandbox's simulated ones both come through here, so a simulation runs
 * exactly the path a real event does.
 */
@Injectable()
export class InboundEventIngestor {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(INBOUND_QUEUE) private readonly inbound: Queue<InboundJob>,
  ) {}

  async ingest(channelType: ChannelType, payload: unknown): Promise<{ eventId: string }> {
    const event = await this.prisma.inboundEvent.create({
      data: { channelType, payload: payload as Prisma.InputJsonValue },
      select: { id: true },
    });
    await this.inbound.add('event', { eventId: event.id }, { jobId: event.id });
    return { eventId: event.id };
  }
}
