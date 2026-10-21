import { Injectable, Logger } from '@nestjs/common';
import {
  type ChannelDto,
  type ChannelType,
  ErrorCode,
  hasRole,
  type MediaDto,
} from '@conversa/shared';
import { AppConfig } from '../../config/app-config.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { AppException } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Channel } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { type ChannelSession, ProviderError } from './provider/channel-provider.js';
import { ProviderRegistry } from './provider/provider.registry.js';

const STATE_TTL_SECONDS = 10 * 60;

interface StoredCredentials {
  accessToken: string;
}

interface OAuthState {
  w: string;
  u: string;
  t: ChannelType;
}

export function toChannelDto(channel: Channel): ChannelDto {
  return {
    id: channel.id,
    type: channel.type,
    externalId: channel.externalId,
    username: channel.username,
    displayName: channel.displayName,
    avatarUrl: channel.avatarUrl,
    status: channel.status,
    webhookSubscribed: channel.webhookSubscribed,
    tokenExpiresAt: channel.tokenExpiresAt?.toISOString() ?? null,
    connectedAt: channel.createdAt.toISOString(),
    lastEventAt: channel.lastEventAt?.toISOString() ?? null,
  };
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly providers: ProviderRegistry,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async list(workspaceId: string): Promise<ChannelDto[]> {
    const channels = await this.prisma.channel.findMany({
      where: { workspaceId, status: { not: 'DISCONNECTED' } },
      orderBy: { createdAt: 'asc' },
    });
    return channels.map(toChannelDto);
  }

  async findInWorkspace(workspaceId: string, channelId: string): Promise<Channel> {
    const channel = await this.prisma.channel.findFirst({ where: { id: channelId, workspaceId } });
    if (!channel) throw AppException.notFound();
    return channel;
  }

  /** Decrypted credentials for a call to the platform. */
  session(channel: Channel): ChannelSession {
    const { accessToken } = this.crypto.decryptJson<StoredCredentials>(channel.credentials);
    return { channelId: channel.id, externalId: channel.externalId, accessToken };
  }

  async activeSession(
    workspaceId: string,
    channelId: string,
  ): Promise<{ channel: Channel; session: ChannelSession }> {
    const channel = await this.findInWorkspace(workspaceId, channelId);
    if (channel.status !== 'ACTIVE') throw new AppException(ErrorCode.CHANNEL_NEEDS_REAUTH);
    return { channel, session: this.session(channel) };
  }

  redirectUri(type: ChannelType): string {
    return this.config.url(`/api/v1/channels/oauth/${type.toLowerCase()}/callback`);
  }

  startConnect(workspaceId: string, userId: string, type: ChannelType): { url: string } {
    const provider = this.providers.getConfigured(type);
    const state = this.crypto.sign(
      'oauth-state',
      { w: workspaceId, u: userId, t: type },
      STATE_TTL_SECONDS,
    );
    return { url: provider.authorizationUrl(state, this.redirectUri(type)) };
  }

  /**
   * Finishes the OAuth flow. The signed state ties the callback to the person
   * and workspace that started it, so a forged or replayed callback cannot
   * attach an account to someone else's workspace.
   */
  async completeConnect(
    type: ChannelType,
    code: string,
    rawState: string,
    userId: string,
  ): Promise<Channel> {
    const state = this.crypto.verify<OAuthState & Record<string, unknown>>('oauth-state', rawState);
    if (!state || state.t !== type || state.u !== userId)
      throw new AppException(ErrorCode.TOKEN_INVALID);
    const membership = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: state.w, userId } },
    });
    if (!membership || !hasRole(membership.role, 'ADMIN')) throw AppException.forbidden();

    const provider = this.providers.getConfigured(type);
    let account;
    try {
      account = await provider.completeAuthorization(code, this.redirectUri(type));
    } catch (error) {
      this.logger.warn({ err: error }, 'OAuth exchange failed');
      throw new AppException(ErrorCode.PROVIDER_ERROR);
    }

    const existing = await this.prisma.channel.findUnique({
      where: { type_externalId: { type, externalId: account.externalId } },
    });
    if (existing && existing.workspaceId !== state.w) {
      if (existing.status !== 'DISCONNECTED')
        throw new AppException(ErrorCode.CHANNEL_IN_OTHER_WORKSPACE);
      await this.prisma.channel.delete({ where: { id: existing.id } });
    }

    const data = {
      username: account.username,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      credentials: this.crypto.encryptJson({
        accessToken: account.accessToken,
      } satisfies StoredCredentials),
      tokenExpiresAt: account.tokenExpiresAt,
      status: 'ACTIVE' as const,
      lastError: null,
    };
    let channel = await this.prisma.channel.upsert({
      where: { type_externalId: { type, externalId: account.externalId } },
      create: {
        ...data,
        type,
        externalId: account.externalId,
        workspaceId: state.w,
        connectedById: userId,
      },
      update: data,
    });

    try {
      await provider.subscribeWebhooks(this.session(channel));
      channel = await this.prisma.channel.update({
        where: { id: channel.id },
        data: { webhookSubscribed: true },
      });
    } catch (error) {
      this.logger.warn({ err: error, channelId: channel.id }, 'Webhook subscription failed');
      channel = await this.prisma.channel.update({
        where: { id: channel.id },
        data: { webhookSubscribed: false, lastError: (error as Error).message.slice(0, 500) },
      });
    }

    await this.audit.record({
      action: 'channel.connected',
      actorId: userId,
      workspaceId: state.w,
      targetType: 'channel',
      targetId: channel.id,
      metadata: { type, username: account.username },
    });
    return channel;
  }

  /**
   * Forgets the credentials and pauses the channel's automations, keeping
   * history. Reconnecting the same account brings everything back.
   */
  async disconnect(workspaceId: string, channelId: string, actorId: string | null): Promise<void> {
    const channel = await this.findInWorkspace(workspaceId, channelId);
    await this.prisma.$transaction([
      this.prisma.channel.update({
        where: { id: channel.id },
        data: {
          status: 'DISCONNECTED',
          credentials: this.crypto.encryptJson({ accessToken: '' }),
          webhookSubscribed: false,
        },
      }),
      this.prisma.automation.updateMany({
        where: { channelId: channel.id, status: 'ACTIVE' },
        data: { status: 'PAUSED' },
      }),
    ]);
    await this.audit.record({
      action: 'channel.disconnected',
      actorId,
      workspaceId,
      targetType: 'channel',
      targetId: channel.id,
    });
  }

  /** Called when the platform rejects the credentials. */
  async markNeedsReauth(channelId: string, error: unknown): Promise<void> {
    await this.prisma.channel.updateMany({
      where: { id: channelId, status: 'ACTIVE' },
      data: {
        status: 'NEEDS_REAUTH',
        lastError: String((error as Error)?.message ?? error).slice(0, 500),
      },
    });
  }

  async listMedia(workspaceId: string, channelId: string, limit: number): Promise<MediaDto[]> {
    const { channel, session } = await this.activeSession(workspaceId, channelId);
    return this.callProvider(channel, () =>
      this.providers.get(channel.type).listMedia(session, limit),
    );
  }

  /** Runs a provider call for a request, translating provider failures into API errors. */
  async callProvider<T>(channel: Channel, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      if (error.kind === 'auth') {
        await this.markNeedsReauth(channel.id, error);
        throw new AppException(ErrorCode.CHANNEL_NEEDS_REAUTH);
      }
      if (error.kind === 'window_closed') throw new AppException(ErrorCode.MESSAGING_WINDOW_CLOSED);
      if (error.kind === 'rate_limit') throw new AppException(ErrorCode.RATE_LIMITED);
      this.logger.warn({ err: error, channelId: channel.id }, 'Provider call failed');
      throw new AppException(ErrorCode.PROVIDER_ERROR);
    }
  }
}
