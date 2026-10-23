import type { InboundEvent, InboundSender } from '../provider/channel-provider.js';
import { parseJsonKeepingIds } from './tiktok-json.js';

interface TikTokUser {
  id?: string;
  role?: string;
}

interface MessageContent {
  from?: string;
  from_user?: TikTokUser;
  to_user?: TikTokUser;
  conversation_id?: string;
  message_id?: string;
  type?: string;
  text?: { body?: string };
  is_follower?: boolean;
  message_tag?: { source?: string };
  reply_source_payload?: { reply_source_msg_id?: string; reply_source_unique_id?: string };
}

interface WebhookEnvelope {
  event?: string;
  user_openid?: string;
  /** A JSON document in a string. */
  content?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}

function readContent(raw: unknown): MessageContent | null {
  if (typeof raw === 'string') {
    if (raw.length > 64_000) return null;
    try {
      const parsed = parseJsonKeepingIds(raw);
      return parsed && typeof parsed === 'object' ? (parsed as MessageContent) : null;
    } catch {
      return null;
    }
  }
  return raw && typeof raw === 'object' ? (raw as MessageContent) : null;
}

/**
 * A direct message to the account. Replies are sent to a conversation, not to
 * a person, so the conversation id identifies the contact.
 */
function parseReceivedMessage(accountId: string, content: MessageContent): InboundEvent | null {
  // The account's own messages (including Conversa's) come back too; reacting to them could loop.
  if (content.from_user?.role === 'business_account' || content.message_tag?.source === 'API')
    return null;
  const conversationId = asString(content.conversation_id);
  if (!conversationId) return null;
  const sender: InboundSender = {
    externalId: conversationId,
    username: asString(content.from)?.slice(0, 64) ?? null,
    follows: typeof content.is_follower === 'boolean' ? content.is_follower : null,
  };

  // A tap on a Q&A card button arrives as the button's text, with the id we gave the button.
  const payload = asString(content.reply_source_payload?.reply_source_unique_id);
  if (payload) {
    return { kind: 'postback', accountExternalId: accountId, sender, payload };
  }

  const messageId = asString(content.message_id);
  const text = typeof content.text?.body === 'string' ? content.text.body.trim() : '';
  if (content.type !== 'text' || !messageId || !text) return null;
  return {
    kind: 'message',
    accountExternalId: accountId,
    messageId,
    text: text.slice(0, 2_200),
    sender,
    isStoryReply: false,
  };
}

/** Normalises a TikTok webhook delivery. Unknown shapes are dropped, never thrown on. */
export function parseTikTokWebhook(input: unknown): InboundEvent[] {
  const envelope = input as WebhookEnvelope;
  if (!envelope || typeof envelope !== 'object' || envelope.event !== 'im_receive_msg') return [];
  const content = readContent(envelope.content);
  if (!content) return [];
  const accountId = asString(envelope.user_openid) ?? asString(content.to_user?.id);
  if (!accountId) return [];
  const event = parseReceivedMessage(accountId, content);
  return event ? [event] : [];
}
