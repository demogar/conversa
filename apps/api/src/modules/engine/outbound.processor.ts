import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { DelayedError, type Job } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { OUTBOUND_QUEUE, type OutboundJob } from '../../infra/queue/queues.js';
import { ChannelsService } from '../channels/channels.service.js';
import { ProviderError } from '../channels/provider/channel-provider.js';
import { DeliveryService } from './delivery.service.js';

/** A rate-limited delivery waits for at most this many windows before it is skipped. */
const MAX_DEFERRALS = 6;

type OutboundJobData = OutboundJob & { deferrals?: number };

@Processor(OUTBOUND_QUEUE, { concurrency: 5, limiter: { max: 20, duration: 1_000 } })
export class OutboundProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboundProcessor.name);

  constructor(
    private readonly deliveries: DeliveryService,
    private readonly channels: ChannelsService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<OutboundJobData>, token?: string): Promise<void> {
    const { deliveryId } = job.data;
    try {
      const outcome =
        job.data.kind === 'start'
          ? await this.deliveries.start(deliveryId)
          : await this.deliveries.continueAfterTap(deliveryId);
      if (outcome.type === 'defer') await this.defer(job, outcome.delayMs, token);
    } catch (error) {
      if (error instanceof DelayedError) throw error;
      if (!(error instanceof ProviderError)) throw error;
      if (error.kind === 'auth') {
        const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId }, select: { channelId: true } });
        if (delivery) await this.channels.markNeedsReauth(delivery.channelId, error);
      }
      if (error.retryable && !this.isLastAttempt(job)) throw error;
      // Permanent rejections complete the job: retrying would fail the same way.
      await this.deliveries.markFailed(deliveryId, error);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<OutboundJobData> | undefined, error: Error): Promise<void> {
    if (!job || error instanceof DelayedError) return;
    this.logger.warn({ err: error, deliveryId: job.data.deliveryId, attempt: job.attemptsMade }, 'Delivery step failed');
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) await this.deliveries.markFailed(job.data.deliveryId, error);
  }

  private async defer(job: Job<OutboundJobData>, delayMs: number, token: string | undefined): Promise<void> {
    const deferrals = job.data.deferrals ?? 0;
    if (deferrals >= MAX_DEFERRALS || !token) {
      await this.deliveries.markSkipped(job.data.deliveryId, 'RATE_LIMITED');
      return;
    }
    await job.updateData({ ...job.data, deferrals: deferrals + 1 });
    await job.moveToDelayed(Date.now() + delayMs, token);
    throw new DelayedError();
  }

  private isLastAttempt(job: Job): boolean {
    return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
  }
}
