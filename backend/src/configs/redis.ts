// src/configs/redis.ts
import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

// Upstash Redis connection (free tier - 10k commands/day)
export const redisClient = new Redis(env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  enableReadyCheck: false, // required for Upstash
  lazyConnect: false,
  tls: {},
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) return true;
    return false;
  },
});

redisClient.on('error', (err) => logger.error('Redis error:', err));
redisClient.on('connect', () => logger.info('Redis connecting...'));
redisClient.on('ready', () => logger.info('Redis ready'));

// Separate connection for BullMQ (required by bullmq)
export const bullMQConnection = new Redis(env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null, // required for BullMQ
  enableReadyCheck: false,
  tls: {},
  lazyConnect: false,
});

// Cache utilities
// L1 Memory Cache (reduces Redis round-trips for high-frequency safe lookups)
const l1Cache = new Map<string, { value: any; expiresAt: number }>();

export const cache = {
  // Clear expired L1 cache items periodically
  async cleanL1(): Promise<void> {
    const now = Date.now();
    for (const [key, item] of l1Cache.entries()) {
      if (item.expiresAt < now) l1Cache.delete(key);
    }
  },

  async get<T>(key: string, useL1 = false): Promise<T | null> {
    if (useL1) {
      const l1Item = l1Cache.get(key);
      if (l1Item && l1Item.expiresAt > Date.now()) {
        return l1Item.value as T;
      }
    }

    const val = await redisClient.get(key);
    if (!val) return null;

    try {
      const parsed = JSON.parse(val);
      if (useL1) l1Cache.set(key, { value: parsed, expiresAt: Date.now() + 60000 }); // 60s L1 cache
      return parsed;
    } catch {
      if (useL1) l1Cache.set(key, { value: val as unknown as T, expiresAt: Date.now() + 60000 });
      return val as unknown as T;
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number, useL1 = false): Promise<void> {
    const serialized = JSON.stringify(value);
    
    if (useL1) {
      l1Cache.set(key, { value, expiresAt: Date.now() + (ttlSeconds ? ttlSeconds * 1000 : 60000) });
    }

    if (ttlSeconds) {
      await redisClient.setex(key, ttlSeconds, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
  },

  async del(key: string): Promise<void> {
    l1Cache.delete(key);
    await redisClient.del(key);
  },

  async exists(key: string): Promise<boolean> {
    const l1Item = l1Cache.get(key);
    if (l1Item && l1Item.expiresAt > Date.now()) return true;
    return (await redisClient.exists(key)) === 1;
  },

  // Idempotency key for webhook deduplication (TTL 24h)
  async setIdempotencyKey(key: string): Promise<boolean> {
    const result = await redisClient.set(`idempotent:${key}`, '1', 'EX', 86400, 'NX');
    return result === 'OK';
  },

  // Rate limiting with sliding window
  async rateLimitCheck(key: string, limit: number, windowSecs: number): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = now - windowSecs * 1000;
    const multi = redisClient.multi();
    multi.zremrangebyscore(key, '-inf', windowStart);
    multi.zadd(key, now, `${now}-${Math.random()}`);
    multi.zcard(key);
    multi.expire(key, windowSecs);
    const results = await multi.exec();
    const count = (results?.[2]?.[1] as number) || 0;
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  },
};

// Periodically clean L1 cache
setInterval(() => cache.cleanL1(), 60000);

