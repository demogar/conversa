import { Redis } from 'ioredis';

/** Leaves nothing behind in the shared Redis; the test database is kept for the next run. */
export default async function globalTeardown(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;
  // Derived again (logical database 15), so a failed setup can never flush another database.
  const url = new URL(redisUrl);
  url.pathname = '/15';
  const redis = new Redis(url.toString(), { maxRetriesPerRequest: 1 });
  try {
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}
