import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  type AppCredentialsCheck,
  type ChannelType,
  type ConversationDto,
  LIMITS,
  type MediaDto,
  type MessageDto,
} from '@conversa/shared';
import { AppConfig } from '../../../config/app-config.js';
import { InjectRedis } from '../../../infra/redis/redis.module.js';
import { safeEqual } from '../../../common/crypto/crypto.service.js';
import { InstanceSettingsService } from '../../instance/instance-settings.service.js';
import type {
  ChannelCredentials,
  ChannelProvider,
  ChannelSession,
  ConnectedAccount,
  ContactProfile,
  InboundEvent,
  OutboundMessage,
  RefreshedCredentials,
  SendOptions,
  SendResult,
} from '../provider/channel-provider.js';
import { ProviderError } from '../provider/channel-provider.js';
import { TikTokApiClient } from './tiktok-api.client.js';
import { parseTikTokWebhook } from './tiktok-webhook.parser.js';

/** TikTok signs `<t>.<body>`; older timestamps are refused so a captured delivery cannot be replayed. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const VIDEO_FIELDS = [
  'item_id',
  'caption',
  'create_time',
  'thumbnail_url',
  'share_url',
  'media_type',
];
/** Q&A cards: a title of 40 characters and up to three reply buttons of 20. */
const CARD_TITLE_LENGTH = 40;
const CARD_BUTTONS = 3;
const CARD_BUTTON_LENGTH = 20;
/** How long the parts of a step that went out are remembered, for its retries. */
const SENT_PART_TTL_SECONDS = 24 * 3600;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  open_id: string;
  expires_in?: number;
}

interface TikTokVideo {
  item_id: string;
  caption?: string;
  create_time?: string | number;
  thumbnail_url?: string;
  share_url?: string;
  media_type?: string;
}

interface TikTokConversation {
  conversation_id: string;
  update_time?: number;
}

interface TikTokMessage {
  sender?: string;
  message_id: string;
  timestamp?: number;
  message_type?: string;
  text?: { body?: string };
  message_tag?: { source?: string };
}

/** A code TikTok never issues, so the exchange always fails and only the reason matters. */
const PROBE_CODE = 'conversa-credentials-check';

/**
 * Reads TikTok's answer to a code exchange made with a code that cannot work:
 * a complaint about the code means the app ID and secret passed, one about
 * the app or the secret means they did not. Anything else is unknown.
 */
export function classifyTikTokCredentialsProbe(message: string): AppCredentialsCheck {
  if (/secret|app[ _]?id|client[ _]?(id|key)|invalid app/i.test(message)) return 'invalid';
  if (/auth(ori[sz]ation)?[ _]code|code (is )?(invalid|expired)|invalid code/i.test(message))
    return 'valid';
  return 'unknown';
}

/**
 * The messages TikTok gets for one outbound message. TikTok has no link
 * buttons, so links are written under the text. Tap buttons become a Q&A
 * card; its title holds only 40 characters, so a longer text goes first as
 * its own message and the card follows, titled with its first button.
 */
export function toTikTokMessages(message: OutboundMessage): Array<Record<string, unknown>> {
  const links = (message.buttons ?? []).flatMap((button) =>
    button.type === 'url' ? [`${button.label}: ${button.url}`] : [],
  );
  const text = [message.text.slice(0, LIMITS.dmTextLength), ...links].join('\n\n');
  const replies = (message.buttons ?? [])
    .flatMap((button) => (button.type === 'postback' ? [button] : []))
    .slice(0, CARD_BUTTONS);
  if (replies.length === 0) return [{ message_type: 'TEXT', text: { body: text } }];

  const card = (title: string) => ({
    message_type: 'TEMPLATE',
    template: {
      type: 'QA_BUTTON_CARD',
      title: title.slice(0, CARD_TITLE_LENGTH),
      buttons: replies.map((button) => ({
        type: 'REPLY',
        title: button.label.slice(0, CARD_BUTTON_LENGTH),
        id: button.payload,
      })),
    },
  });
  if (text.length <= CARD_TITLE_LENGTH) return [card(text)];
  return [{ message_type: 'TEXT', text: { body: text } }, card(replies[0]!.label)];
}

function toMedia(video: TikTokVideo): MediaDto {
  const created = Number(video.create_time);
  return {
    id: video.item_id,
    caption: video.caption ?? null,
    mediaType: video.media_type ?? 'VIDEO',
    thumbnailUrl: video.thumbnail_url ?? null,
    permalink: video.share_url ?? null,
    publishedAt: new Date(
      Number.isFinite(created) && created > 0 ? created * 1000 : Date.now(),
    ).toISOString(),
    commentsCount: null,
  };
}

function expiresAt(seconds: number | undefined): Date | null {
  return seconds ? new Date(Date.now() + seconds * 1000) : null;
}

/**
 * TikTok through its API for Business: direct messages only. TikTok cannot
 * message the author of a comment, so comments never start automations here
 * (see docs/tiktok.md), and it says whether someone follows the account only
 * in its message webhooks.
 */
@Injectable()
export class TikTokProvider implements ChannelProvider {
  readonly type: ChannelType = 'TIKTOK';

  constructor(
    private readonly api: TikTokApiClient,
    private readonly settings: InstanceSettingsService,
    private readonly config: AppConfig,
    @InjectRedis() private readonly redis: Pick<Redis, 'get' | 'set'>,
  ) {}

  isConfigured(): boolean {
    return this.settings.tiktok !== null;
  }

  private get app() {
    const app = this.settings.tiktok;
    if (!app) throw new ProviderError('rejected', 'TikTok app credentials are not configured');
    return app;
  }

  // ---- Connecting ---------------------------------------------------------

  /**
   * The URL TikTok generated for the app, plus the state. The redirect URL is
   * the one registered with TikTok, which must be this installation's.
   */
  authorizationUrl(state: string): string {
    const url = new URL(this.app.authorizationUrl);
    url.searchParams.set('state', state);
    // Without it, an account that already approved the app comes back without a code.
    url.searchParams.set('disable_auto_auth', '1');
    return url.toString();
  }

  async checkAppCredentials(redirectUri: string): Promise<AppCredentialsCheck> {
    const app = this.settings.tiktok;
    if (!app) return 'not_configured';
    try {
      await this.exchange(PROBE_CODE, redirectUri);
      return 'unknown';
    } catch (error) {
      if (!(error instanceof ProviderError) || error.kind === 'transient') return 'unknown';
      return classifyTikTokCredentialsProbe(error.message);
    }
  }

  async completeAuthorization(code: string, redirectUri: string): Promise<ConnectedAccount> {
    const token = await this.exchange(code, redirectUri);
    const profile = await this.api.request<{
      username?: string;
      display_name?: string;
      profile_image?: string;
    }>({
      path: '/business/get/',
      query: { business_id: token.open_id, fields: ['username', 'display_name', 'profile_image'] },
      accessToken: token.access_token,
    });
    return {
      externalId: token.open_id,
      username: profile.username || profile.display_name || token.open_id,
      displayName: profile.display_name ?? null,
      avatarUrl: profile.profile_image ?? null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiresAt: expiresAt(token.expires_in),
    };
  }

  /** Access tokens last a day; the refresh token (a year) gets a new one. */
  async refreshCredentials({ refreshToken }: ChannelCredentials): Promise<RefreshedCredentials> {
    if (!refreshToken) throw new ProviderError('auth', 'TikTok channel has no refresh token');
    const token = await this.api.request<TokenResponse>({
      method: 'POST',
      path: '/tt_user/oauth2/refresh_token/',
      body: {
        client_id: this.app.appId,
        client_secret: this.app.appSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
    });
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenExpiresAt: expiresAt(token.expires_in),
    };
  }

  /** TikTok's webhook is one per app, not per account; setting it again is harmless. */
  async subscribeWebhooks(): Promise<void> {
    await this.api.request({
      method: 'POST',
      path: '/business/webhook/update/',
      body: {
        app_id: this.app.appId,
        secret: this.app.appSecret,
        event_type: 'DIRECT_MESSAGE',
        callback_url: this.config.url('/api/v1/webhooks/tiktok'),
      },
    });
  }

  private exchange(code: string, redirectUri: string): Promise<TokenResponse> {
    return this.api.request<TokenResponse>({
      method: 'POST',
      path: '/tt_user/oauth2/token/',
      body: {
        client_id: this.app.appId,
        client_secret: this.app.appSecret,
        grant_type: 'authorization_code',
        auth_code: code,
        redirect_uri: redirectUri,
      },
    });
  }

  // ---- Webhooks -----------------------------------------------------------

  /** TikTok has no subscription handshake. */
  verifySubscription(): string | null {
    return null;
  }

  /** `Tiktok-Signature: t=<seconds>,s=<hex HMAC-SHA256 of "<t>.<body>" with the app secret>`. */
  verifySignature(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const app = this.settings.tiktok;
    const header = headers['tiktok-signature'];
    const value = Array.isArray(header) ? header[0] : header;
    if (!app || !value || value.length > 512) return false;
    const parts = new Map(
      value.split(',').map((part) => {
        const at = part.indexOf('=');
        return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const;
      }),
    );
    const timestamp = parts.get('t');
    const signature = parts.get('s');
    if (!timestamp || !/^\d{1,12}$/.test(timestamp) || !signature) return false;
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false;
    const expected = createHmac('sha256', app.appSecret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex');
    return safeEqual(signature.toLowerCase(), expected);
  }

  parse(payload: unknown): InboundEvent[] {
    return parseTikTokWebhook(payload);
  }

  // ---- Messaging ----------------------------------------------------------

  async sendPrivateReply(): Promise<SendResult> {
    throw new ProviderError('rejected', 'TikTok cannot send a private reply to a comment');
  }

  /**
   * The recipient is a conversation id: TikTok sends to conversations, not
   * people. A message may go out as two requests (text, then card); with an
   * idempotency key, a retry skips the part that already went out, so the
   * contact never gets the text twice.
   */
  async sendMessage(
    session: ChannelSession,
    conversationId: string,
    message: OutboundMessage,
    options: SendOptions = {},
  ): Promise<SendResult> {
    let messageId: string | null = null;
    const parts = toTikTokMessages(message);
    for (const [index, body] of parts.entries()) {
      const sentKey =
        options.idempotencyKey && parts.length > 1
          ? `conversa:tiktok:sent:${session.channelId}:${options.idempotencyKey}:${index}`
          : null;
      if (sentKey && (await this.redis.get(sentKey))) continue;
      const result = await this.api.request<{ message?: { message_id?: string } }>({
        method: 'POST',
        path: '/business/message/send/',
        body: {
          business_id: session.externalId,
          recipient_type: 'CONVERSATION',
          recipient: conversationId,
          ...body,
        },
        accessToken: session.accessToken,
      });
      messageId = result.message?.message_id || messageId;
      if (sentKey) await this.redis.set(sentKey, messageId ?? '1', 'EX', SENT_PART_TTL_SECONDS);
    }
    return { messageId };
  }

  async replyToComment(): Promise<void> {
    throw new ProviderError('rejected', 'Comment automations are not available on TikTok');
  }

  /** TikTok has no lookup by person; the message webhooks carry what it tells. */
  async getContactProfile(): Promise<ContactProfile> {
    return { username: null, follows: null };
  }

  // ---- Content ------------------------------------------------------------

  async listMedia(session: ChannelSession, limit: number): Promise<MediaDto[]> {
    const page = await this.api.request<{ videos?: TikTokVideo[] }>({
      path: '/business/video/list/',
      query: {
        business_id: session.externalId,
        fields: VIDEO_FIELDS,
        max_count: Math.min(Math.max(limit, 1), 20),
      },
      accessToken: session.accessToken,
    });
    return (page.videos ?? []).map(toMedia);
  }

  async getMedia(session: ChannelSession, mediaId: string): Promise<MediaDto | null> {
    try {
      const page = await this.api.request<{ videos?: TikTokVideo[] }>({
        path: '/business/video/list/',
        query: {
          business_id: session.externalId,
          fields: VIDEO_FIELDS,
          filters: { video_ids: [mediaId] },
        },
        accessToken: session.accessToken,
      });
      const video = page.videos?.find((item) => item.item_id === mediaId);
      return video ? toMedia(video) : null;
    } catch (error) {
      if (error instanceof ProviderError && error.kind === 'rejected') return null;
      throw error;
    }
  }

  /**
   * Accepted conversations and message requests, newest first. TikTok names
   * neither side, so the participant is the conversation itself, which is
   * also how contacts are identified.
   */
  async listConversations(session: ChannelSession): Promise<ConversationDto[]> {
    const pages = await Promise.all(
      (['SINGLE', 'STRANGER'] as const).map((conversationType) =>
        this.api.request<{ conversations?: TikTokConversation[] }>({
          path: '/business/message/conversation/list/',
          query: {
            business_id: session.externalId,
            conversation_type: conversationType,
            limit: 25,
          },
          accessToken: session.accessToken,
        }),
      ),
    );
    return pages
      .flatMap((page) => page.conversations ?? [])
      .sort((a, b) => (b.update_time ?? 0) - (a.update_time ?? 0))
      .slice(0, 25)
      .map((conversation) => ({
        id: conversation.conversation_id,
        participant: { id: conversation.conversation_id, username: null },
        lastMessage: null,
        updatedAt: conversation.update_time
          ? new Date(conversation.update_time).toISOString()
          : null,
      }));
  }

  async listMessages(session: ChannelSession, conversationId: string): Promise<MessageDto[]> {
    const page = await this.api.request<{ messages?: TikTokMessage[] }>({
      path: '/business/message/content/list/',
      query: { business_id: session.externalId, conversation_id: conversationId },
      accessToken: session.accessToken,
    });
    return (page.messages ?? [])
      .map((message) => ({
        id: message.message_id,
        text: message.text?.body ?? null,
        fromSelf:
          message.message_tag?.source === 'API' ||
          (session.username !== undefined && message.sender === session.username),
        createdAt: message.timestamp ? new Date(message.timestamp).toISOString() : null,
        timestamp: message.timestamp ?? 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(({ timestamp: _timestamp, ...message }) => message);
  }
}
