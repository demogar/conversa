/**
 * The contract every messaging platform implements. The rest of Conversa
 * (webhooks, the automation engine, the inbox) talks only to these
 * interfaces, so adding a platform means adding one provider and registering
 * it in ProvidersModule, without touching the engine.
 */
import type { ChannelType, ConversationDto, MediaDto, MessageDto } from '@conversa/shared';

/** Decrypted credentials for one connected account, for the duration of a call. */
export interface ChannelSession {
  channelId: string;
  externalId: string;
  accessToken: string;
}

// ---------------------------------------------------------------------------
// Inbound events, normalised from each platform's webhook format
// ---------------------------------------------------------------------------

export interface InboundCommentEvent {
  kind: 'comment';
  accountExternalId: string;
  commentId: string;
  text: string;
  author: { externalId: string; username: string | null };
  /** The commented media and, for ads, the organic post the ad came from. */
  mediaIds: string[];
}

export interface InboundMessageEvent {
  kind: 'message';
  accountExternalId: string;
  messageId: string;
  text: string;
  sender: { externalId: string };
  isStoryReply: boolean;
}

export interface InboundPostbackEvent {
  kind: 'postback';
  accountExternalId: string;
  sender: { externalId: string };
  payload: string;
}

export type InboundEvent = InboundCommentEvent | InboundMessageEvent | InboundPostbackEvent;

// ---------------------------------------------------------------------------
// Outbound messages
// ---------------------------------------------------------------------------

export type MessageButton =
  | { type: 'url'; label: string; url: string }
  | { type: 'postback'; label: string; payload: string };

export interface OutboundMessage {
  text: string;
  buttons?: MessageButton[];
}

export interface SendResult {
  messageId: string | null;
}

/**
 * Why a platform call failed, which decides what happens next:
 * - `auth`: the credentials no longer work; the channel needs reconnecting.
 * - `rate_limit`: try again later.
 * - `window_closed`: the platform's messaging window has passed.
 * - `rejected`: the request will never succeed as sent.
 * - `transient`: network trouble or a platform outage; retry.
 */
export type ProviderErrorKind = 'auth' | 'rate_limit' | 'window_closed' | 'rejected' | 'transient';

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  get retryable(): boolean {
    return this.kind === 'rate_limit' || this.kind === 'transient';
  }
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export interface ConnectedAccount {
  externalId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  accessToken: string;
  tokenExpiresAt: Date | null;
}

export interface RefreshedCredentials {
  accessToken: string;
  tokenExpiresAt: Date | null;
}

/** Connecting an account through the platform's OAuth flow. */
export interface ChannelConnector {
  authorizationUrl(state: string, redirectUri: string): string;
  completeAuthorization(code: string, redirectUri: string): Promise<ConnectedAccount>;
  refreshCredentials(accessToken: string): Promise<RefreshedCredentials>;
  subscribeWebhooks(session: ChannelSession): Promise<void>;
}

/** Receiving the platform's webhooks. */
export interface WebhookAdapter {
  /** Answers the platform's subscription handshake, or null to refuse it. */
  verifySubscription(query: Record<string, unknown>): string | null;
  verifySignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  parse(payload: unknown): InboundEvent[];
}

export interface ContactProfile {
  username: string | null;
  /** Whether the person follows the account. */
  follows: boolean | null;
}

/** Sending on behalf of a connected account. */
export interface Messenger {
  /** Replies privately to the author of a comment. Platforms allow one per comment. */
  sendPrivateReply(session: ChannelSession, commentId: string, message: OutboundMessage): Promise<SendResult>;
  sendMessage(session: ChannelSession, recipientId: string, message: OutboundMessage): Promise<SendResult>;
  replyToComment(session: ChannelSession, commentId: string, text: string): Promise<void>;
  /** What the platform will say about a person; null fields are unknown. */
  getContactProfile(session: ChannelSession, userId: string): Promise<ContactProfile>;
}

/** Reading the account's content and conversations. */
export interface ContentSource {
  listMedia(session: ChannelSession, limit: number): Promise<MediaDto[]>;
  getMedia(session: ChannelSession, mediaId: string): Promise<MediaDto | null>;
  listConversations(session: ChannelSession): Promise<ConversationDto[]>;
  listMessages(session: ChannelSession, conversationId: string): Promise<MessageDto[]>;
}

export interface ChannelProvider extends ChannelConnector, WebhookAdapter, Messenger, ContentSource {
  readonly type: ChannelType;
  /** False when the instance has no app credentials for this platform. */
  isConfigured(): boolean;
}
