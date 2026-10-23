import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CHANNEL_CAPABILITIES, ErrorCode, type SimulateEventInput } from '@conversa/shared';
import { AppConfig } from '../../../config/app-config.js';
import { AppException } from '../../../common/errors/app.exception.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import type { Channel } from '../../../generated/prisma/client.js';
import { PostbackTokens } from '../../engine/postback-token.js';
import { InboundEventIngestor } from '../../webhooks/inbound-event.ingestor.js';
import { ChannelsService } from '../channels.service.js';
import {
  buildCommentPayload,
  buildMessagePayload,
  buildPostbackPayload,
  buildTikTokMessagePayload,
  buildTikTokTapPayload,
  sandboxUserId,
} from './sandbox-events.js';
import { SandboxOutbox, type SandboxOutboxEntry } from './sandbox-outbox.js';

/**
 * Injects simulated Instagram and TikTok events. Each one is stored and queued exactly
 * like a real webhook, so the worker runs the whole pipeline on it.
 */
@Injectable()
export class SandboxService {
  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly ingestor: InboundEventIngestor,
    private readonly outbox: SandboxOutbox,
    private readonly tokens: PostbackTokens,
  ) {}

  async simulate(
    workspaceId: string,
    channelId: string,
    input: SimulateEventInput,
  ): Promise<{ eventId: string }> {
    const channel = await this.channel(workspaceId, channelId);
    if (input.kind === 'message') {
      const messageId = `sandbox-mid-${randomBytes(8).toString('hex')}`;
      await this.outbox.recordReceived(channel.id, {
        id: messageId,
        sender: sandboxUserId(input.username),
        text: input.text,
        timestamp: new Date().toISOString(),
      });
      const message = {
        accountId: channel.externalId,
        messageId,
        username: input.username,
        text: input.text,
      };
      const payload =
        channel.type === 'TIKTOK'
          ? buildTikTokMessagePayload(message)
          : buildMessagePayload(message);
      return this.ingestor.ingest(channel.type, payload);
    }

    if (!CHANNEL_CAPABILITIES[channel.type].commentTriggers) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { kind: ['not_supported_by_channel'] });
    }

    const commentId = `sandbox-comment-${randomBytes(8).toString('hex')}`;
    await this.outbox.rememberCommentAuthor(commentId, sandboxUserId(input.username));
    const payload = buildCommentPayload({
      accountId: channel.externalId,
      commentId,
      username: input.username,
      text: input.text,
      mediaId: input.mediaId || `${channel.id}-post-1`,
    });
    return this.ingestor.ingest(channel.type, payload);
  }

  /** The contact who received a delivery's button taps it. */
  async tap(
    workspaceId: string,
    channelId: string,
    deliveryId: string,
  ): Promise<{ eventId: string }> {
    const channel = await this.channel(workspaceId, channelId);
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, channelId: channel.id },
      select: { id: true, contact: { select: { externalId: true } } },
    });
    if (!delivery) throw AppException.notFound();
    const tap = {
      accountId: channel.externalId,
      senderId: delivery.contact.externalId,
      payload: this.tokens.create(
        delivery.id,
        CHANNEL_CAPABILITIES[channel.type].postbackPayloadLength,
      ),
    };
    const payload =
      channel.type === 'TIKTOK'
        ? buildTikTokTapPayload({
            ...tap,
            messageId: `sandbox-mid-${randomBytes(8).toString('hex')}`,
          })
        : buildPostbackPayload(tap);
    return this.ingestor.ingest(channel.type, payload);
  }

  async outboxFor(workspaceId: string, channelId: string): Promise<SandboxOutboxEntry[]> {
    const channel = await this.channel(workspaceId, channelId);
    return this.outbox.list(channel.id);
  }

  /** Every sandbox route is a 404 unless the sandbox is on. */
  private async channel(workspaceId: string, channelId: string): Promise<Channel> {
    if (!this.config.sandbox) throw AppException.notFound();
    return this.channels.findInWorkspace(workspaceId, channelId);
  }
}
