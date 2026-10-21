import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '../../infra/redis/redis.module.js';

/** Meta documents 750 private replies per hour per professional account. */
export const PRIVATE_REPLIES_PER_HOUR = 750;
const WINDOW_SECONDS = 3600;

// Takes a slot if one is free; returns {taken, ms until the window resets}.
const TAKE = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then
  return {0, redis.call('PTTL', KEYS[1])}
end
count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return {1, redis.call('PTTL', KEYS[1])}
`;

export interface SlotResult {
  taken: boolean;
  retryInMs: number;
}

/** Per-channel hourly budget for private replies, shared by every worker. */
@Injectable()
export class SendRateLimiter {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async takePrivateReplySlot(channelId: string): Promise<SlotResult> {
    const [taken, ttl] = (await this.redis.eval(
      TAKE,
      1,
      this.key(channelId),
      PRIVATE_REPLIES_PER_HOUR,
      WINDOW_SECONDS,
    )) as [number, number];
    return { taken: taken === 1, retryInMs: Math.max(ttl, 1_000) };
  }

  /** Gives back a slot whose send was rejected, so failures do not eat the budget. */
  async releasePrivateReplySlot(channelId: string): Promise<void> {
    const remaining = await this.redis.decr(this.key(channelId));
    if (remaining < 0) await this.redis.del(this.key(channelId));
  }

  private key(channelId: string): string {
    return `conversa:rate:private-reply:${channelId}`;
  }
}
