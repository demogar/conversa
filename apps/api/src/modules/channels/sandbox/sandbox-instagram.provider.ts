import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  type ChannelType,
  type ConversationDto,
  LIMITS,
  type MediaDto,
  type MessageDto,
} from '@conversa/shared';
import { parseInstagramWebhook } from '../instagram/instagram-webhook.parser.js';
import type {
  ChannelProvider,
  ChannelSession,
  ConnectedAccount,
  ContactProfile,
  InboundEvent,
  OutboundMessage,
  RefreshedCredentials,
  SendResult,
} from '../provider/channel-provider.js';
import { sandboxUsername } from './sandbox-events.js';
import { SandboxOutbox, type SandboxOutboxEntry, type SandboxSendKind } from './sandbox-outbox.js';

const TOKEN_LIFETIME_MS = 60 * 24 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const POSTS = [
  { caption: 'New guide is out! Comment LINK and I will send it to you.', color: '#e4405f' },
  { caption: 'Behind the scenes of this week. Comment INFO for the details.', color: '#f77737' },
  {
    caption: 'Five tips for better mornings. Want the checklist? Comment CHECKLIST.',
    color: '#fcaf45',
  },
  { caption: 'Our spring collection just dropped. Comment PRICE for prices.', color: '#833ab4' },
  { caption: 'Free workshop next Tuesday. Comment JOIN to save a seat.', color: '#405de6' },
  { caption: 'Thank you for 10k followers!', color: '#2e9e6b' },
];

function thumbnail(color: string, n: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">` +
    `<rect width="320" height="320" fill="${color}"/>` +
    `<text x="160" y="190" font-family="sans-serif" font-size="120" fill="#fff" text-anchor="middle">${n}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Six fixed posts per channel, one a day going back from today. */
export function sandboxMedia(channelId: string, now = new Date()): MediaDto[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  return POSTS.map((post, index) => {
    const n = index + 1;
    return {
      id: `${channelId}-post-${n}`,
      caption: post.caption,
      mediaType: 'IMAGE',
      thumbnailUrl: thumbnail(post.color, n),
      permalink: `https://www.instagram.com/p/SANDBOX${n}/`,
      publishedAt: new Date(today - index * DAY_MS).toISOString(),
      commentsCount: null,
    };
  });
}

function randomId(prefix: string): string {
  return `${prefix}-${randomBytes(8).toString('hex')}`;
}

/**
 * A simulated Instagram, used instead of the real one when INSTAGRAM_SANDBOX
 * is on. Connecting creates a fake account, events are injected through the
 * sandbox endpoints, and everything Conversa "sends" lands in a per-channel
 * outbox in Redis instead of reaching Instagram.
 */
@Injectable()
export class SandboxInstagramProvider implements ChannelProvider {
  readonly type: ChannelType = 'INSTAGRAM';
  private readonly logger = new Logger(SandboxInstagramProvider.name);

  constructor(private readonly outbox: SandboxOutbox) {}

  isConfigured(): boolean {
    return true;
  }

  // ---- Connecting ---------------------------------------------------------

  /** Skips the consent screen: straight back to the callback, which finishes the flow. */
  authorizationUrl(state: string, redirectUri: string): string {
    return `${redirectUri}?code=sandbox&state=${encodeURIComponent(state)}`;
  }

  /** A new fake account every time, so a workspace can connect several. */
  async completeAuthorization(): Promise<ConnectedAccount> {
    return {
      externalId: `sandbox-${randomBytes(4).toString('hex')}`,
      username: `sandbox_${randomBytes(2).toString('hex')}`,
      displayName: 'Sandbox account',
      avatarUrl: null,
      accessToken: randomBytes(24).toString('hex'),
      tokenExpiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
    };
  }

  async refreshCredentials(): Promise<RefreshedCredentials> {
    return {
      accessToken: randomBytes(24).toString('hex'),
      tokenExpiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS),
    };
  }

  async subscribeWebhooks(): Promise<void> {}

  // ---- Webhooks -----------------------------------------------------------

  verifySubscription(): string | null {
    return null;
  }

  /** Simulated events never come in as webhooks, so real-looking ones are refused. */
  verifySignature(): boolean {
    return false;
  }

  parse(payload: unknown): InboundEvent[] {
    return parseInstagramWebhook(payload);
  }

  // ---- Messaging ----------------------------------------------------------

  async sendPrivateReply(
    session: ChannelSession,
    commentId: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    const recipient = (await this.outbox.commentAuthor(commentId)) ?? commentId;
    return this.record(session, 'private_reply', recipient, commentId, message);
  }

  async sendMessage(
    session: ChannelSession,
    recipientId: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    return this.record(session, 'message', recipientId, null, message);
  }

  async replyToComment(session: ChannelSession, commentId: string, text: string): Promise<void> {
    const recipient = (await this.outbox.commentAuthor(commentId)) ?? commentId;
    await this.record(session, 'public_reply', recipient, commentId, {
      text: text.slice(0, LIMITS.publicReplyLength),
    });
  }

  /** Everyone follows the account, except usernames containing "nofollow". */
  async getContactProfile(_session: ChannelSession, userId: string): Promise<ContactProfile> {
    return { username: null, follows: !userId.toLowerCase().includes('nofollow') };
  }

  private async record(
    session: ChannelSession,
    kind: SandboxSendKind,
    recipient: string,
    commentId: string | null,
    message: OutboundMessage,
  ): Promise<SendResult> {
    const entry: SandboxOutboxEntry = {
      id: randomId('sandbox-msg'),
      kind,
      recipient,
      commentId,
      message,
      timestamp: new Date().toISOString(),
    };
    await this.outbox.record(session.channelId, entry);
    this.logger.log(
      { channelId: session.channelId, kind, recipient, text: message.text },
      'Sandbox send',
    );
    return { messageId: entry.id };
  }

  // ---- Content ------------------------------------------------------------

  async listMedia(session: ChannelSession, limit: number): Promise<MediaDto[]> {
    return sandboxMedia(session.channelId).slice(0, Math.max(limit, 1));
  }

  /** Unknown ids still resolve, as a post published now, so any id can be commented on. */
  async getMedia(session: ChannelSession, mediaId: string): Promise<MediaDto | null> {
    const known = sandboxMedia(session.channelId).find((media) => media.id === mediaId);
    return (
      known ?? {
        id: mediaId,
        caption: null,
        mediaType: 'IMAGE',
        thumbnailUrl: null,
        permalink: null,
        publishedAt: new Date().toISOString(),
        commentsCount: null,
      }
    );
  }

  async listConversations(session: ChannelSession): Promise<ConversationDto[]> {
    const conversations = new Map<string, ConversationDto>();
    for (const message of await this.thread(session.channelId)) {
      // Re-inserting keeps the map ordered by each conversation's latest message.
      conversations.delete(message.contactId);
      conversations.set(message.contactId, {
        id: message.contactId,
        participant: { id: message.contactId, username: sandboxUsername(message.contactId) },
        lastMessage: message.text,
        updatedAt: message.createdAt,
      });
    }
    return [...conversations.values()].reverse();
  }

  async listMessages(session: ChannelSession, conversationId: string): Promise<MessageDto[]> {
    return (await this.thread(session.channelId))
      .filter((message) => message.contactId === conversationId)
      .map(({ id, text, fromSelf, createdAt }) => ({ id, text, fromSelf, createdAt }));
  }

  /** Both sides of every simulated conversation, oldest first; a message comes before a reply sent the same instant. */
  private async thread(
    channelId: string,
  ): Promise<Array<MessageDto & { contactId: string; createdAt: string }>> {
    const [sent, received] = await Promise.all([
      this.outbox.list(channelId),
      this.outbox.listReceived(channelId),
    ]);
    return [
      ...received.reverse().map((entry) => ({
        id: entry.id,
        contactId: entry.sender,
        text: entry.text,
        fromSelf: false,
        createdAt: entry.timestamp,
      })),
      ...sent.reverse().map((entry) => ({
        id: entry.id,
        contactId: entry.recipient,
        text: entry.message.text,
        fromSelf: true,
        createdAt: entry.timestamp,
      })),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
