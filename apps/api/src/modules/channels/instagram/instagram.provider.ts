import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  type ChannelType,
  type ConversationDto,
  LIMITS,
  type MediaDto,
  type MessageDto,
} from '@conversa/shared';
import { safeEqual } from '../../../common/crypto/crypto.service.js';
import { InstanceSettingsService } from '../../instance/instance-settings.service.js';
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
import { ProviderError } from '../provider/channel-provider.js';
import { InstagramGraphClient } from './instagram-graph.client.js';
import { parseInstagramWebhook } from './instagram-webhook.parser.js';

const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const TOKEN_HOST = 'https://api.instagram.com';
const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
];
const WEBHOOK_FIELDS = 'comments,messages,messaging_postbacks';
const MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,comments_count';

interface GraphMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  comments_count?: number;
}

interface GraphMessage {
  id: string;
  created_time?: string;
  message?: string;
  from?: { id: string; username?: string };
}

interface GraphConversation {
  id: string;
  updated_time?: string;
  participants?: { data?: Array<{ id: string; username?: string }> };
  messages?: { data?: GraphMessage[] };
}

function toMedia(media: GraphMedia): MediaDto {
  return {
    id: media.id,
    caption: media.caption ?? null,
    mediaType: media.media_type,
    thumbnailUrl:
      media.thumbnail_url ?? (media.media_type === 'VIDEO' ? null : (media.media_url ?? null)),
    permalink: media.permalink ?? null,
    publishedAt: media.timestamp,
    commentsCount: media.comments_count ?? null,
  };
}

/** Instagram's button template: up to three buttons, titles capped at 20 characters. */
function toPlatformMessage(message: OutboundMessage): unknown {
  const text = message.text.slice(0, LIMITS.dmTextLength);
  if (!message.buttons?.length) return { text };
  return {
    attachment: {
      type: 'template',
      payload: {
        template_type: 'button',
        text,
        buttons: message.buttons.slice(0, LIMITS.dmButtons).map((button) =>
          button.type === 'url'
            ? {
                type: 'web_url',
                url: button.url,
                title: button.label.slice(0, LIMITS.buttonLabelLength),
              }
            : {
                type: 'postback',
                payload: button.payload,
                title: button.label.slice(0, LIMITS.buttonLabelLength),
              },
        ),
      },
    },
  };
}

@Injectable()
export class InstagramProvider implements ChannelProvider {
  readonly type: ChannelType = 'INSTAGRAM';

  constructor(
    private readonly graph: InstagramGraphClient,
    private readonly settings: InstanceSettingsService,
  ) {}

  isConfigured(): boolean {
    return this.settings.instagram !== null;
  }

  private get app() {
    const app = this.settings.instagram;
    if (!app) throw new ProviderError('rejected', 'Instagram app credentials are not configured');
    return app;
  }

  // ---- Connecting ---------------------------------------------------------

  authorizationUrl(state: string, redirectUri: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: this.app.appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(','),
      state,
      enable_fb_login: '0',
      force_authentication: '1',
    }).toString();
    return url.toString();
  }

  async completeAuthorization(code: string, redirectUri: string): Promise<ConnectedAccount> {
    const short = await this.graph.request<{ access_token: string }>({
      method: 'POST',
      host: TOKEN_HOST,
      path: '/oauth/access_token',
      form: {
        client_id: this.app.appId,
        client_secret: this.app.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      },
    });
    // Short-lived tokens last an hour; exchange for a 60-day token right away.
    const long = await this.graph.request<{ access_token: string; expires_in?: number }>({
      host: 'https://graph.instagram.com',
      path: '/access_token',
      query: { grant_type: 'ig_exchange_token', client_secret: this.app.appSecret },
      accessToken: short.access_token,
    });
    const profile = await this.graph.request<{
      user_id?: string | number;
      id: string;
      username: string;
      name?: string;
      profile_picture_url?: string;
    }>({
      path: '/me',
      query: { fields: 'user_id,username,name,profile_picture_url' },
      accessToken: long.access_token,
    });
    return {
      // Webhooks identify the account by its professional id (user_id), not
      // by the app-scoped id returned as `id`.
      externalId: String(profile.user_id ?? profile.id),
      username: profile.username,
      displayName: profile.name ?? null,
      avatarUrl: profile.profile_picture_url ?? null,
      accessToken: long.access_token,
      tokenExpiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
    };
  }

  async refreshCredentials(accessToken: string): Promise<RefreshedCredentials> {
    const result = await this.graph.request<{ access_token: string; expires_in?: number }>({
      host: 'https://graph.instagram.com',
      path: '/refresh_access_token',
      query: { grant_type: 'ig_refresh_token' },
      accessToken,
    });
    return {
      accessToken: result.access_token,
      tokenExpiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000) : null,
    };
  }

  async subscribeWebhooks(session: ChannelSession): Promise<void> {
    await this.graph.request({
      method: 'POST',
      path: `/${session.externalId}/subscribed_apps`,
      query: { subscribed_fields: WEBHOOK_FIELDS },
      accessToken: session.accessToken,
    });
  }

  // ---- Webhooks -----------------------------------------------------------

  verifySubscription(query: Record<string, unknown>): string | null {
    const app = this.settings.instagram;
    if (!app) return null;
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    if (
      query['hub.mode'] !== 'subscribe' ||
      typeof token !== 'string' ||
      typeof challenge !== 'string'
    )
      return null;
    if (!safeEqual(token, app.verifyToken)) return null;
    return /^[\w-]{1,128}$/.test(challenge) ? challenge : null;
  }

  verifySignature(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    const app = this.settings.instagram;
    const header = headers['x-hub-signature-256'];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!app || !signature) return false;
    const expected = `sha256=${createHmac('sha256', app.appSecret).update(rawBody).digest('hex')}`;
    return safeEqual(signature, expected);
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
    return this.send(session, { comment_id: commentId }, message);
  }

  async sendMessage(
    session: ChannelSession,
    recipientId: string,
    message: OutboundMessage,
  ): Promise<SendResult> {
    return this.send(session, { id: recipientId }, message);
  }

  async replyToComment(session: ChannelSession, commentId: string, text: string): Promise<void> {
    await this.graph.request({
      method: 'POST',
      path: `/${commentId}/replies`,
      body: { message: text.slice(0, LIMITS.publicReplyLength) },
      accessToken: session.accessToken,
    });
  }

  /**
   * Instagram answers only for people in an open conversation with the
   * account, so every field may come back unknown.
   */
  async getContactProfile(session: ChannelSession, userId: string): Promise<ContactProfile> {
    try {
      const profile = await this.graph.request<{
        username?: string;
        is_user_follow_business?: boolean;
      }>({
        path: `/${encodeURIComponent(userId)}`,
        query: { fields: 'username,is_user_follow_business' },
        accessToken: session.accessToken,
      });
      return {
        username: profile.username ?? null,
        follows:
          typeof profile.is_user_follow_business === 'boolean'
            ? profile.is_user_follow_business
            : null,
      };
    } catch (error) {
      if (error instanceof ProviderError && error.kind === 'auth') throw error;
      return { username: null, follows: null };
    }
  }

  private async send(
    session: ChannelSession,
    recipient: Record<string, string>,
    message: OutboundMessage,
  ) {
    const result = await this.graph.request<{ message_id?: string }>({
      method: 'POST',
      path: `/${session.externalId}/messages`,
      body: { recipient, message: toPlatformMessage(message) },
      accessToken: session.accessToken,
    });
    return { messageId: result.message_id ?? null };
  }

  // ---- Content ------------------------------------------------------------

  async listMedia(session: ChannelSession, limit: number): Promise<MediaDto[]> {
    const page = await this.graph.request<{ data?: GraphMedia[] }>({
      path: `/${session.externalId}/media`,
      query: { fields: MEDIA_FIELDS, limit: String(Math.min(Math.max(limit, 1), 100)) },
      accessToken: session.accessToken,
    });
    return (page.data ?? []).map(toMedia);
  }

  async getMedia(session: ChannelSession, mediaId: string): Promise<MediaDto | null> {
    try {
      const media = await this.graph.request<GraphMedia>({
        path: `/${encodeURIComponent(mediaId)}`,
        query: { fields: MEDIA_FIELDS },
        accessToken: session.accessToken,
      });
      return toMedia(media);
    } catch (error) {
      if (error instanceof ProviderError && error.kind === 'rejected') return null;
      throw error;
    }
  }

  async listConversations(session: ChannelSession): Promise<ConversationDto[]> {
    const page = await this.graph.request<{ data?: GraphConversation[] }>({
      path: `/${session.externalId}/conversations`,
      query: {
        platform: 'instagram',
        fields: 'participants,updated_time,messages.limit(1){message,from,created_time}',
        limit: '25',
      },
      accessToken: session.accessToken,
    });
    return (page.data ?? []).map((conversation) => {
      const other =
        conversation.participants?.data?.find((p) => p.id !== session.externalId) ??
        conversation.participants?.data?.[0];
      return {
        id: conversation.id,
        participant: { id: other?.id ?? '', username: other?.username ?? null },
        lastMessage: conversation.messages?.data?.[0]?.message ?? null,
        updatedAt: conversation.updated_time ?? null,
      };
    });
  }

  async listMessages(session: ChannelSession, conversationId: string): Promise<MessageDto[]> {
    const conversation = await this.graph.request<{ messages?: { data?: GraphMessage[] } }>({
      path: `/${encodeURIComponent(conversationId)}`,
      query: { fields: 'messages{id,created_time,from,message}' },
      accessToken: session.accessToken,
    });
    return (conversation.messages?.data ?? [])
      .map((message) => ({
        id: message.id,
        text: message.message ?? null,
        fromSelf: message.from?.id === session.externalId,
        createdAt: message.created_time ?? null,
      }))
      .reverse();
  }
}
