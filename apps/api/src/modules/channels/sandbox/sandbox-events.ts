/**
 * Builds simulated webhook payloads in each platform's own format, so they go
 * through the same parser and engine as real deliveries.
 */

const USER_PREFIX = 'sandbox-user-';

/** The same username always maps to the same contact. */
export function sandboxUserId(username: string): string {
  return `${USER_PREFIX}${username.toLowerCase()}`;
}

/** The username behind a simulated contact id, or null for any other id. */
export function sandboxUsername(userId: string): string | null {
  return userId.startsWith(USER_PREFIX) ? userId.slice(USER_PREFIX.length) : null;
}

interface SimulatedBase {
  /** The connected account's externalId. */
  accountId: string;
  now?: Date;
}

export function buildCommentPayload(
  input: SimulatedBase & { commentId: string; username: string; text: string; mediaId: string },
) {
  const now = input.now ?? new Date();
  return {
    object: 'instagram',
    entry: [
      {
        id: input.accountId,
        time: Math.floor(now.getTime() / 1000),
        changes: [
          {
            field: 'comments',
            value: {
              id: input.commentId,
              text: input.text,
              from: { id: sandboxUserId(input.username), username: input.username },
              media: { id: input.mediaId },
            },
          },
        ],
      },
    ],
  };
}

export function buildMessagePayload(
  input: SimulatedBase & { messageId: string; username: string; text: string },
) {
  return messagingPayload(input, sandboxUserId(input.username), {
    message: { mid: input.messageId, text: input.text },
  });
}

/** A tap on a postback button, sent by the contact who received it. */
export function buildPostbackPayload(input: SimulatedBase & { senderId: string; payload: string }) {
  return messagingPayload(input, input.senderId, {
    postback: { title: 'Tap', payload: input.payload },
  });
}

function messagingPayload(input: SimulatedBase, senderId: string, body: Record<string, unknown>) {
  const now = input.now ?? new Date();
  return {
    object: 'instagram',
    entry: [
      {
        id: input.accountId,
        time: Math.floor(now.getTime() / 1000),
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: input.accountId },
            timestamp: now.getTime(),
            ...body,
          },
        ],
      },
    ],
  };
}

// ---- TikTok ---------------------------------------------------------------

/** Simulated TikTok users follow the account unless their username says "nofollow". */
function follows(username: string): boolean {
  return !username.toLowerCase().includes('nofollow');
}

/**
 * TikTok's `im_receive_msg`, whose content is a JSON string. The conversation
 * id doubles as the contact's id, as with the real TikTok.
 */
function tiktokMessagePayload(
  input: SimulatedBase & { username: string; messageId: string; text: string },
  extra: Record<string, unknown> = {},
) {
  const now = input.now ?? new Date();
  const userId = sandboxUserId(input.username);
  return {
    client_key: 'sandbox',
    event: 'im_receive_msg',
    create_time: Math.floor(now.getTime() / 1000),
    user_openid: input.accountId,
    content: JSON.stringify({
      from: input.username,
      to: 'sandbox',
      unique_identifier: userId,
      from_user: { id: userId, role: 'personal_account' },
      to_user: { id: input.accountId, role: 'business_account' },
      conversation_id: userId,
      message_id: input.messageId,
      timestamp: now.getTime(),
      type: 'text',
      text: { body: input.text },
      is_follower: follows(input.username),
      message_tag: { source: 'APP' },
      ...extra,
    }),
  };
}

export function buildTikTokMessagePayload(
  input: SimulatedBase & { messageId: string; username: string; text: string },
) {
  return tiktokMessagePayload(input);
}

/** A tap on a Q&A card button: TikTok sends the button's text with the id we gave it. */
export function buildTikTokTapPayload(
  input: SimulatedBase & { senderId: string; messageId: string; payload: string },
) {
  const username = sandboxUsername(input.senderId) ?? input.senderId;
  return tiktokMessagePayload(
    { ...input, username, text: 'Tap' },
    {
      reply_source_payload: {
        reply_source_msg_id: input.messageId,
        reply_source_unique_id: input.payload,
      },
    },
  );
}
