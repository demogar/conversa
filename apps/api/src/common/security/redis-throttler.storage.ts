import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { InjectRedis } from '../../infra/redis/redis.module.js';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// Counts hits in a fixed window and blocks the key once over the limit.
// Returns hits, ms to window expiry, blocked flag and ms to block expiry.
const SCRIPT = `
local hits_key = KEYS[1]
local block_key = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block = tonumber(ARGV[3])

local blocked_ttl = redis.call('PTTL', block_key)
if blocked_ttl > 0 then
  return { limit + 1, redis.call('PTTL', hits_key), 1, blocked_ttl }
end

local hits = redis.call('INCR', hits_key)
if hits == 1 then redis.call('PEXPIRE', hits_key, ttl) end
local expire = redis.call('PTTL', hits_key)

if hits > limit then
  redis.call('SET', block_key, 1, 'PX', block)
  return { hits, expire, 1, block }
end
return { hits, expire, 0, 0 }
`;

/** Shares rate-limit counters between every API instance through Redis. */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const base = `conversa:throttle:${throttlerName}:${key}`;
    const [hits, expire, blocked, blockExpire] = (await this.redis.eval(
      SCRIPT,
      2,
      `${base}:hits`,
      `${base}:block`,
      ttl,
      limit,
      blockDuration > 0 ? blockDuration : ttl,
    )) as [number, number, number, number];
    return {
      totalHits: hits,
      timeToExpire: Math.ceil(Math.max(expire, 0) / 1000),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.ceil(Math.max(blockExpire, 0) / 1000),
    };
  }
}
