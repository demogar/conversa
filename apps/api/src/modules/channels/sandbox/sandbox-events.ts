/**
 * Builds simulated webhook payloads in Instagram's own format, so they go
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

export function buildMessagePayload(input: SimulatedBase & { messageId: string; username: string; text: string }) {
  return messagingPayload(input, sandboxUserId(input.username), { message: { mid: input.messageId, text: input.text } });
}

/** A tap on a postback button, sent by the contact who received it. */
export function buildPostbackPayload(input: SimulatedBase & { senderId: string; payload: string }) {
  return messagingPayload(input, input.senderId, { postback: { title: 'Tap', payload: input.payload } });
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
