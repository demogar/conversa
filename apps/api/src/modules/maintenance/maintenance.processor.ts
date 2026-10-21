import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { MAINTENANCE_QUEUE, MaintenanceTask } from '../../infra/queue/queues.js';
import { BufferService } from '../buffer/buffer.service.js';
import { ChannelsService } from '../channels/channels.service.js';
import { ProviderError } from '../channels/provider/channel-provider.js';
import { ProviderRegistry } from '../channels/provider/provider.registry.js';
import { ScopeResolver } from '../engine/scope-resolver.js';

const DAY_MS = 86_400_000;
/** Long-lived Instagram tokens last 60 days; refresh well before the end. */
const REFRESH_WITHIN_MS = 10 * DAY_MS;
const KEEP_EVENTS_MS = 14 * DAY_MS;

const SCHEDULE: Array<{ task: MaintenanceTask; every: number }> = [
  { task: MaintenanceTask.RESOLVE_SCOPES, every: 5 * 60_000 },
  { task: MaintenanceTask.REFRESH_TOKENS, every: 6 * 3600_000 },
  { task: MaintenanceTask.CLEANUP, every: DAY_MS },
];

@Processor(MAINTENANCE_QUEUE, { concurrency: 1 })
export class MaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly channels: ChannelsService,
    private readonly providers: ProviderRegistry,
    private readonly scopes: ScopeResolver,
    private readonly buffer: BufferService,
  ) {
    super();
  }

  /** Schedulers are idempotent: every worker upserts the same ones. */
  async onApplicationBootstrap(): Promise<void> {
    for (const { task, every } of SCHEDULE) {
      await this.queue.upsertJobScheduler(task, { every }, { name: task, opts: { attempts: 1 } });
    }
  }

  async process(job: Job): Promise<void> {
    switch (job.name as MaintenanceTask) {
      case MaintenanceTask.RESOLVE_SCOPES:
        await this.scopes.resolvePending();
        await this.buffer.resolveArmedAutomations((automationId, mediaId) => this.scopes.bind(automationId, mediaId));
        return;
      case MaintenanceTask.REFRESH_TOKENS:
        return this.refreshTokens();
      case MaintenanceTask.CLEANUP:
        return this.cleanup();
    }
  }

  private async refreshTokens(): Promise<void> {
    const channels = await this.prisma.channel.findMany({ where: { status: 'ACTIVE' } });
    for (const channel of channels) {
      const expiring = channel.tokenExpiresAt && channel.tokenExpiresAt.getTime() - Date.now() < REFRESH_WITHIN_MS;
      const staleKey = this.crypto.needsReencryption(channel.credentials);
      if (!expiring && !staleKey) continue;
      try {
        const session = this.channels.session(channel);
        const refreshed = expiring
          ? await this.providers.get(channel.type).refreshCredentials(session.accessToken)
          : { accessToken: session.accessToken, tokenExpiresAt: channel.tokenExpiresAt };
        await this.prisma.channel.update({
          where: { id: channel.id },
          data: {
            credentials: this.crypto.encryptJson({ accessToken: refreshed.accessToken }),
            tokenExpiresAt: refreshed.tokenExpiresAt,
          },
        });
      } catch (error) {
        this.logger.warn({ err: error, channelId: channel.id }, 'Token refresh failed');
        if (error instanceof ProviderError && error.kind === 'auth') {
          await this.channels.markNeedsReauth(channel.id, error);
        }
      }
    }
  }

  private async cleanup(): Promise<void> {
    const now = new Date();
    const [sessions, events, resets, invitations] = await Promise.all([
      this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.inboundEvent.deleteMany({ where: { receivedAt: { lt: new Date(now.getTime() - KEEP_EVENTS_MS) } } }),
      this.prisma.passwordReset.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } }),
      this.prisma.invitation.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 30 * DAY_MS) } } }),
    ]);
    this.logger.log(
      { sessions: sessions.count, events: events.count, resets: resets.count, invitations: invitations.count },
      'Cleanup finished',
    );
  }
}
