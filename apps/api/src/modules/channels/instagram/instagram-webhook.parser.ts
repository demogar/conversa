import type { InboundEvent } from '../provider/channel-provider.js';

interface CommentValue {
  id?: string;
  text?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string; original_media_id?: string };
}

interface MessagingItem {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    quick_reply?: { payload?: string };
    reply_to?: { story?: { id?: string } };
  };
  postback?: { payload?: string };
}

interface WebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: CommentValue }>;
    messaging?: MessagingItem[];
  }>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}

function parseMessaging(accountId: string, item: MessagingItem): InboundEvent | null {
  const senderId = asString(item.sender?.id);
  // Anything the account sent itself (including Conversa's own replies)
  // comes back as an echo; reacting to it could loop.
  if (!senderId || senderId === accountId) return null;

  const postbackPayload =
    asString(item.postback?.payload) ?? asString(item.message?.quick_reply?.payload);
  if (postbackPayload) {
    return {
      kind: 'postback',
      accountExternalId: accountId,
      sender: { externalId: senderId },
      payload: postbackPayload,
    };
  }

  const message = item.message;
  if (!message || message.is_echo || message.is_deleted || message.is_unsupported) return null;
  const messageId = asString(message.mid);
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!messageId || !text) return null;
  return {
    kind: 'message',
    accountExternalId: accountId,
    messageId,
    text: text.slice(0, 2_200),
    sender: { externalId: senderId },
    isStoryReply: Boolean(message.reply_to?.story),
  };
}

function parseComment(accountId: string, value: CommentValue | undefined): InboundEvent | null {
  const commentId = asString(value?.id);
  const authorId = asString(value?.from?.id);
  const mediaId = asString(value?.media?.id);
  // The account's own comments (including public replies we post) never fire automations.
  if (!commentId || !authorId || !mediaId || authorId === accountId) return null;
  const original = asString(value?.media?.original_media_id);
  return {
    kind: 'comment',
    accountExternalId: accountId,
    commentId,
    text: (value?.text ?? '').slice(0, 2_200),
    author: { externalId: authorId, username: asString(value?.from?.username) },
    mediaIds: original && original !== mediaId ? [mediaId, original] : [mediaId],
  };
}

/** Normalises an Instagram webhook delivery. Unknown shapes are dropped, never thrown on. */
export function parseInstagramWebhook(input: unknown): InboundEvent[] {
  const payload = input as WebhookPayload;
  if (payload?.object !== 'instagram' || !Array.isArray(payload.entry)) return [];

  const events: InboundEvent[] = [];
  for (const entry of payload.entry) {
    const accountId = asString(entry?.id);
    if (!accountId) continue;
    for (const change of entry.changes ?? []) {
      if (change?.field !== 'comments') continue;
      const event = parseComment(accountId, change.value);
      if (event) events.push(event);
    }
    for (const item of entry.messaging ?? []) {
      const event = parseMessaging(accountId, item);
      if (event) events.push(event);
    }
  }
  return events;
}
