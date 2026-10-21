import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Automation, Channel } from '../../generated/prisma/client.js';
import { ChannelsService } from '../channels/channels.service.js';
import { ProviderRegistry } from '../channels/provider/provider.registry.js';

/**
 * Binds "next post" automations to the first post published after they were
 * armed. Called when a comment arrives on media none of them knows yet, and
 * periodically by the maintenance queue.
 */
@Injectable()
export class ScopeResolver {
  private readonly logger = new Logger(ScopeResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistry,
    private readonly channels: ChannelsService,
  ) {}

  /** Resolves pending automations against the commented media, updating them in place. */
  async resolveForComment(
    channel: Channel,
    automations: Automation[],
    mediaId: string,
  ): Promise<void> {
    const pending = automations.filter(
      (a) => a.postScope === 'NEXT_POST' && !a.scopeResolvedAt && a.armedAt,
    );
    if (pending.length === 0) return;

    const media = await this.providers
      .get(channel.type)
      .getMedia(this.channels.session(channel), mediaId);
    if (!media) return;
    const publishedAt = new Date(media.publishedAt);

    for (const automation of pending) {
      if (!automation.armedAt || publishedAt < automation.armedAt) continue;
      if (await this.bind(automation.id, media.id)) {
        automation.mediaIds = [media.id];
        automation.scopeResolvedAt = new Date();
      }
    }
  }

  /** Polls each channel with pending automations for a newly published post. */
  async resolvePending(): Promise<void> {
    const pending = await this.prisma.automation.findMany({
      where: {
        postScope: 'NEXT_POST',
        scopeResolvedAt: null,
        armedAt: { not: null },
        status: 'ACTIVE',
      },
      include: { channel: true },
      take: 200,
    });
    const byChannel = new Map<string, { channel: Channel; automations: Automation[] }>();
    for (const { channel, ...automation } of pending) {
      if (channel.status !== 'ACTIVE') continue;
      const group = byChannel.get(channel.id) ?? { channel, automations: [] };
      group.automations.push(automation);
      byChannel.set(channel.id, group);
    }

    for (const { channel, automations } of byChannel.values()) {
      try {
        const media = await this.providers
          .get(channel.type)
          .listMedia(this.channels.session(channel), 5);
        // Oldest first, so each automation gets the first post after it was armed.
        const ordered = [...media].sort(
          (a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt),
        );
        for (const automation of automations) {
          const next = ordered.find(
            (m) => automation.armedAt && new Date(m.publishedAt) >= automation.armedAt,
          );
          if (next) await this.bind(automation.id, next.id);
        }
      } catch (error) {
        this.logger.warn({ err: error, channelId: channel.id }, 'Could not check for a new post');
      }
    }
  }

  /** Binds once; a concurrent resolver that loses the race changes nothing. */
  async bind(automationId: string, mediaId: string): Promise<boolean> {
    const { count } = await this.prisma.automation.updateMany({
      where: { id: automationId, scopeResolvedAt: null },
      data: { mediaIds: [mediaId], scopeResolvedAt: new Date() },
    });
    return count > 0;
  }
}
