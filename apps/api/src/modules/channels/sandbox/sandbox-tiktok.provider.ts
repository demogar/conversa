import { Injectable } from '@nestjs/common';
import type { ChannelType, MediaDto } from '@conversa/shared';
import { parseTikTokWebhook } from '../tiktok/tiktok-webhook.parser.js';
import type {
  ChannelSession,
  ContactProfile,
  InboundEvent,
  SendResult,
} from '../provider/channel-provider.js';
import { ProviderError } from '../provider/channel-provider.js';
import { SandboxInstagramProvider } from './sandbox-instagram.provider.js';

/**
 * A simulated TikTok: the sandbox's accounts, outbox and posts, with TikTok's
 * webhook format and TikTok's limits. Like the real one it answers direct
 * messages only, and learns whether someone follows from their messages.
 */
@Injectable()
export class SandboxTikTokProvider extends SandboxInstagramProvider {
  override readonly type: ChannelType = 'TIKTOK';

  override parse(payload: unknown): InboundEvent[] {
    return parseTikTokWebhook(payload);
  }

  override async sendPrivateReply(): Promise<SendResult> {
    throw new ProviderError('rejected', 'TikTok cannot send a private reply to a comment');
  }

  override async replyToComment(): Promise<void> {
    throw new ProviderError('rejected', 'Comment automations are not available on TikTok');
  }

  override async getContactProfile(): Promise<ContactProfile> {
    return { username: null, follows: null };
  }

  override async listMedia(session: ChannelSession, limit: number): Promise<MediaDto[]> {
    const media = await super.listMedia(session, limit);
    return media.map((item, index) => ({
      ...item,
      mediaType: 'VIDEO',
      permalink: `https://www.tiktok.com/@sandbox/video/${index + 1}`,
    }));
  }
}
