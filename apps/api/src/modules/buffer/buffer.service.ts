import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  type BufferChannelDto,
  type BufferOrganizationDto,
  type BufferPostDto,
  type BufferStatusDto,
  ErrorCode,
} from '@conversa/shared';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';
import type { BufferConnection } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { ChannelsService } from '../channels/channels.service.js';
import { ProviderRegistry } from '../channels/provider/provider.registry.js';
import { BufferClient, BufferError } from './buffer.client.js';
import { instagramShortcode } from './permalink.js';

/** Buffer allows 100 requests per 15 minutes; a short cache keeps the UI well inside it. */
const CACHE_SECONDS = 120;

export type BufferPostView = 'scheduled' | 'sent';

@Injectable()
export class BufferService {
  private readonly logger = new Logger(BufferService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: BufferClient,
    private readonly crypto: CryptoService,
    private readonly channels: ChannelsService,
    private readonly providers: ProviderRegistry,
    private readonly audit: AuditService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async status(workspaceId: string): Promise<BufferStatusDto> {
    const link = await this.prisma.bufferConnection.findUnique({ where: { workspaceId } });
    return {
      connected: link !== null,
      organizationId: link?.organizationId ?? null,
      organizationName: link?.organizationName ?? null,
      lastSyncedAt: link?.lastSyncedAt?.toISOString() ?? null,
      lastError: link?.lastError ?? null,
    };
  }

  /** Validates the key against Buffer before storing it, encrypted. */
  async connect(workspaceId: string, actorId: string, apiKey: string): Promise<BufferStatusDto> {
    const organizations = await this.call(() => this.client.organizations(apiKey));
    const only = organizations.length === 1 ? organizations[0] : undefined;
    const data = {
      apiKey: this.crypto.encrypt(apiKey),
      organizationId: only?.id ?? null,
      organizationName: only?.name ?? null,
      lastError: null,
    };
    await this.prisma.bufferConnection.upsert({
      where: { workspaceId },
      create: { workspaceId, ...data },
      update: data,
    });
    await this.clearCache(workspaceId);
    await this.audit.record({ action: 'buffer.connected', actorId, workspaceId });
    return this.status(workspaceId);
  }

  async disconnect(workspaceId: string, actorId: string): Promise<void> {
    await this.prisma.bufferConnection.deleteMany({ where: { workspaceId } });
    await this.clearCache(workspaceId);
    await this.audit.record({ action: 'buffer.disconnected', actorId, workspaceId });
  }

  async organizations(workspaceId: string): Promise<BufferOrganizationDto[]> {
    const link = await this.requireLink(workspaceId);
    return this.cached(workspaceId, 'organizations', () =>
      this.client.organizations(this.key(link)),
    );
  }

  async selectOrganization(workspaceId: string, organizationId: string): Promise<BufferStatusDto> {
    const organization = (await this.organizations(workspaceId)).find(
      (org) => org.id === organizationId,
    );
    if (!organization) throw AppException.notFound();
    await this.prisma.bufferConnection.update({
      where: { workspaceId },
      data: { organizationId: organization.id, organizationName: organization.name },
    });
    await this.clearCache(workspaceId);
    return this.status(workspaceId);
  }

  /** Buffer's Instagram channels, each linked to the Conversa channel with the same handle. */
  async listChannels(workspaceId: string): Promise<BufferChannelDto[]> {
    const link = await this.requireOrganization(workspaceId);
    const [remote, local] = await Promise.all([
      this.cached(workspaceId, 'channels', () =>
        this.client.channels(this.key(link), link.organizationId),
      ),
      this.prisma.channel.findMany({ where: { workspaceId, status: { not: 'DISCONNECTED' } } }),
    ]);
    return remote
      .filter((channel) => channel.service === 'instagram' && !channel.isDisconnected)
      .map((channel) => {
        const handle = channel.name.replace(/^@/, '').toLowerCase();
        return {
          id: channel.id,
          name: channel.displayName ?? channel.name,
          service: channel.service,
          avatar: channel.avatar,
          linkedChannelId: local.find((c) => c.username.toLowerCase() === handle)?.id ?? null,
        };
      });
  }

  async listPosts(workspaceId: string, view: BufferPostView): Promise<BufferPostDto[]> {
    const link = await this.requireOrganization(workspaceId);
    const channelIds = (await this.listChannels(workspaceId)).map((channel) => channel.id);
    const posts = await this.cached(workspaceId, `posts:${view}`, () =>
      this.client.posts(this.key(link), link.organizationId, {
        status: view === 'scheduled' ? ['scheduled', 'sending'] : ['sent'],
        channelIds,
      }),
    );
    const armed = await this.prisma.automation.findMany({
      where: { workspaceId, bufferPostId: { in: posts.map((post) => post.id) } },
      select: { id: true, bufferPostId: true },
    });
    await this.prisma.bufferConnection.update({
      where: { workspaceId },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
    return posts.map((post) => ({
      id: post.id,
      channelId: post.channelId,
      text: post.text,
      status: post.status,
      dueAt: post.dueAt,
      sentAt: post.sentAt,
      externalLink: post.externalLink,
      thumbnailUrl: post.assets.find((asset) => asset.thumbnail)?.thumbnail ?? null,
      automationIds: armed.filter((a) => a.bufferPostId === post.id).map((a) => a.id),
    }));
  }

  /**
   * Binds automations waiting on a Buffer post to the Instagram media it
   * became. Buffer reports the published post's URL; the media is found on
   * the channel by its shortcode. Run by the maintenance queue.
   */
  async resolveArmedAutomations(
    bind: (automationId: string, mediaId: string) => Promise<boolean>,
  ): Promise<void> {
    const waiting = await this.prisma.automation.findMany({
      where: {
        postScope: 'BUFFER_POST',
        status: 'ACTIVE',
        scopeResolvedAt: null,
        bufferPostId: { not: null },
      },
      include: { channel: true, workspace: { include: { bufferLink: true } } },
      take: 50,
    });

    for (const automation of waiting) {
      const link = automation.workspace.bufferLink;
      if (!link || !automation.bufferPostId || automation.channel.status !== 'ACTIVE') continue;
      try {
        const post = await this.client.post(this.key(link), automation.bufferPostId);
        const shortcode = post?.status === 'sent' ? instagramShortcode(post.externalLink) : null;
        if (!post || !shortcode) continue;
        const media = await this.providers
          .get(automation.channel.type)
          .listMedia(this.channels.session(automation.channel), 25);
        const match = media.find((item) => instagramShortcode(item.permalink) === shortcode);
        if (match && (await bind(automation.id, match.id))) {
          this.logger.log(
            { automationId: automation.id, mediaId: match.id },
            'Bound automation to its Buffer post',
          );
        }
      } catch (error) {
        await this.recordError(link, error);
        if (error instanceof BufferError && error.kind === 'rate_limited') return;
      }
    }
  }

  private async recordError(link: BufferConnection, error: unknown): Promise<void> {
    this.logger.warn({ err: error, workspaceId: link.workspaceId }, 'Buffer sync failed');
    await this.prisma.bufferConnection.update({
      where: { workspaceId: link.workspaceId },
      data: { lastError: error instanceof BufferError ? error.kind : 'unavailable' },
    });
  }

  private key(link: BufferConnection): string {
    return this.crypto.decrypt(link.apiKey);
  }

  private async requireLink(workspaceId: string): Promise<BufferConnection> {
    const link = await this.prisma.bufferConnection.findUnique({ where: { workspaceId } });
    if (!link) throw new AppException(ErrorCode.BUFFER_NOT_CONNECTED);
    return link;
  }

  private async requireOrganization(
    workspaceId: string,
  ): Promise<BufferConnection & { organizationId: string }> {
    const link = await this.requireLink(workspaceId);
    if (!link.organizationId) throw new AppException(ErrorCode.BUFFER_NOT_CONNECTED);
    return link as BufferConnection & { organizationId: string };
  }

  /** Caches Buffer reads per workspace. API keys never reach Redis, only results. */
  private async cached<T>(workspaceId: string, name: string, load: () => Promise<T>): Promise<T> {
    const key = `conversa:buffer:${workspaceId}:${name}`;
    const hit = await this.redis.get(key);
    if (hit) return JSON.parse(hit) as T;
    const value = await this.call(load);
    await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_SECONDS);
    return value;
  }

  private async clearCache(workspaceId: string): Promise<void> {
    const keys = ['organizations', 'channels', 'posts:scheduled', 'posts:sent'].map(
      (name) => `conversa:buffer:${workspaceId}:${name}`,
    );
    await this.redis.del(...keys);
  }

  private async call<T>(load: () => Promise<T>): Promise<T> {
    try {
      return await load();
    } catch (error) {
      if (!(error instanceof BufferError)) throw error;
      if (error.kind === 'unauthorized') throw new AppException(ErrorCode.BUFFER_INVALID_KEY);
      if (error.kind === 'rate_limited') throw new AppException(ErrorCode.BUFFER_RATE_LIMITED);
      throw new AppException(ErrorCode.PROVIDER_ERROR);
    }
  }
}
