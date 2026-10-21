import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '../../../infra/redis/redis.module.js';
import type { OutboundMessage } from '../provider/channel-provider.js';

const OUTBOX_SIZE = 100;
const COMMENT_TTL_SECONDS = 7 * 24 * 3600;

export type SandboxSendKind = 'private_reply' | 'message' | 'public_reply';

/** A simulated direct message from a contact to the account. */
export interface SandboxReceivedEntry {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

/** One message the sandbox "sent" instead of calling Instagram. */
export interface SandboxOutboxEntry {
  id: string;
  kind: SandboxSendKind;
  /** The contact's id, or the comment id when its author is unknown. */
  recipient: string;
  commentId: string | null;
  message: OutboundMessage;
  timestamp: string;
}

/** The Redis commands the outbox uses, so tests can stand in a plain object. */
export type SandboxRedis = Pick<Redis, 'lpush' | 'ltrim' | 'lrange' | 'set' | 'get'>;

/**
 * What the simulated Instagram remembers: the last messages sent from and
 * received by each channel (the inbox shows both sides), and who wrote each simulated comment (a private reply names only
 * the comment, but the outbox shows who received it).
 */
@Injectable()
export class SandboxOutbox {
  constructor(@InjectRedis() private readonly redis: SandboxRedis) {}

  record(channelId: string, entry: SandboxOutboxEntry): Promise<void> {
    return this.push(`conversa:sandbox:outbox:${channelId}`, entry);
  }

  /** Newest first. */
  list(channelId: string): Promise<SandboxOutboxEntry[]> {
    return this.read(`conversa:sandbox:outbox:${channelId}`);
  }

  recordReceived(channelId: string, entry: SandboxReceivedEntry): Promise<void> {
    return this.push(`conversa:sandbox:received:${channelId}`, entry);
  }

  /** Newest first. */
  listReceived(channelId: string): Promise<SandboxReceivedEntry[]> {
    return this.read(`conversa:sandbox:received:${channelId}`);
  }

  async rememberCommentAuthor(commentId: string, userId: string): Promise<void> {
    await this.redis.set(commentKey(commentId), userId, 'EX', COMMENT_TTL_SECONDS);
  }

  commentAuthor(commentId: string): Promise<string | null> {
    return this.redis.get(commentKey(commentId));
  }

  private async push(key: string, entry: object): Promise<void> {
    await this.redis.lpush(key, JSON.stringify(entry));
    await this.redis.ltrim(key, 0, OUTBOX_SIZE - 1);
  }

  private async read<T>(key: string): Promise<T[]> {
    const items = await this.redis.lrange(key, 0, OUTBOX_SIZE - 1);
    return items.map((item) => JSON.parse(item) as T);
  }
}

function commentKey(commentId: string): string {
  return `conversa:sandbox:comment:${commentId}`;
}
