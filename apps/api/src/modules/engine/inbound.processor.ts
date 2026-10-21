import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { INBOUND_QUEUE, type InboundJob } from '../../infra/queue/queues.js';
import { ProviderRegistry } from '../channels/provider/provider.registry.js';
import { InboundEventHandler } from './inbound-event.handler.js';

@Processor(INBOUND_QUEUE, { concurrency: 10 })
export class InboundProcessor extends WorkerHost {
  private readonly logger = new Logger(InboundProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistry,
    private readonly handler: InboundEventHandler,
  ) {
    super();
  }

  async process(job: Job<InboundJob>): Promise<void> {
    const stored = await this.prisma.inboundEvent.findUnique({ where: { id: job.data.eventId } });
    if (!stored || stored.status === 'PROCESSED' || stored.status === 'IGNORED') return;

    const provider = this.providers.get(stored.channelType);
    let handled = 0;
    for (const event of provider.parse(stored.payload)) {
      if (await this.handler.handle(provider.type, event)) handled += 1;
    }
    await this.prisma.inboundEvent.update({
      where: { id: stored.id },
      data: { status: handled > 0 ? 'PROCESSED' : 'IGNORED', processedAt: new Date(), error: null },
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<InboundJob> | undefined, error: Error): Promise<void> {
    if (!job) return;
    this.logger.error(
      { err: error, eventId: job.data.eventId, attempt: job.attemptsMade },
      'Inbound event failed',
    );
    if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await this.prisma.inboundEvent.updateMany({
        where: { id: job.data.eventId },
        data: { status: 'FAILED', error: error.message.slice(0, 1000) },
      });
    }
  }
}
