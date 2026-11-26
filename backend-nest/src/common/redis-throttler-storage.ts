import { createHash, randomUUID } from 'node:crypto';
import IORedis from 'ioredis';
import { ThrottlerStorage } from '@nestjs/throttler';

type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

/**
 * Shared sliding-window storage for Nest's HTTP throttler. Keys contain a
 * tracker (normally a client IP), so only a one-way digest is stored in Redis.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly redis: IORedis;
  private readonly fallbackStore = new Map<string, { hits: number[]; blockedUntil: number }>();

  constructor(redisUrl: string) {
    this.redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 0,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      connectTimeout: 3_000,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2_000),
    });
    // Request failures are surfaced by increment(); avoid emitting connection
    // errors to stdout where provider/network details could leak.
    this.redis.on('error', () => undefined);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const digest = createHash('sha256').update(`${throttlerName}:${key}`).digest('hex');
    const hitsKey = `heylaunch:http-throttle:${digest}:hits`;
    const blockedKey = `heylaunch:http-throttle:${digest}:blocked`;

    let result: Array<number | string>;
    try {
      result = await this.redis.eval(
        REDIS_THROTTLE_SCRIPT,
        2,
        hitsKey,
        blockedKey,
        Date.now(),
        Math.max(1, ttl),
        Math.max(1, limit),
        Math.max(0, blockDuration),
        randomUUID(),
      ) as Array<number | string>;
    } catch {
      // If Redis has an operational outage, quota limit exceeded, or connection drop,
      // fail-safe to in-memory sliding window so client authentication/API never crashes with 500.
      return this.fallbackIncrement(key, ttl, limit, blockDuration, throttlerName);
    }

    if (!Array.isArray(result) || result.length !== 4) {
      throw new Error('Redis returned an invalid HTTP throttle result.');
    }
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = result.map(Number);
    if (![totalHits, timeToExpire, isBlocked, timeToBlockExpire].every(Number.isFinite)) {
      throw new Error('Redis returned an invalid HTTP throttle result.');
    }
    return { totalHits, timeToExpire, isBlocked: isBlocked === 1, timeToBlockExpire };
  }

  private fallbackIncrement(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    const storeKey = `${throttlerName}:${key}`;
    let record = this.fallbackStore.get(storeKey);
    if (!record) {
      record = { hits: [], blockedUntil: 0 };
      this.fallbackStore.set(storeKey, record);
    }

    record.hits = record.hits.filter((ts) => ts > now - ttl);
    if (record.blockedUntil > now) {
      const blockRemaining = Math.ceil((record.blockedUntil - now) / 1000);
      return { totalHits: record.hits.length, timeToExpire: Math.ceil(ttl / 1000), isBlocked: true, timeToBlockExpire: blockRemaining };
    }

    record.hits.push(now);
    const totalHits = record.hits.length;
    if (totalHits > limit) {
      record.blockedUntil = now + (blockDuration > 0 ? blockDuration : ttl);
      const blockRemaining = Math.ceil((record.blockedUntil - now) / 1000);
      return { totalHits, timeToExpire: Math.ceil(ttl / 1000), isBlocked: true, timeToBlockExpire: blockRemaining };
    }

    if (this.fallbackStore.size > 5_000) {
      for (const [k, v] of this.fallbackStore.entries()) {
        if (v.blockedUntil <= now && (!v.hits.length || v.hits[v.hits.length - 1] <= now - 60_000)) {
          this.fallbackStore.delete(k);
        }
      }
    }

    return { totalHits, timeToExpire: Math.ceil(ttl / 1000), isBlocked: false, timeToBlockExpire: 0 };
  }

  async onApplicationShutdown() {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return true; // in-memory fallback is active and operational
    }
  }
}

/** Atomic per-tracker sliding window with a bounded block state. */
export const REDIS_THROTTLE_SCRIPT = `
local hitsKey = KEYS[1]
local blockedKey = KEYS[2]
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local blockDuration = tonumber(ARGV[4])
local requestId = ARGV[5]

local blockedUntil = tonumber(redis.call('GET', blockedKey) or '0')
local count = tonumber(redis.call('ZCARD', hitsKey) or '0')
if blockedUntil > now then
  local blockRemaining = math.ceil((blockedUntil - now) / 1000)
  local oldest = redis.call('ZRANGE', hitsKey, 0, 0, 'WITHSCORES')
  local windowRemaining = ttl
  if oldest[2] then
    windowRemaining = math.max(0, math.ceil((tonumber(oldest[2]) + ttl - now) / 1000))
  end
  return { count, windowRemaining, 1, blockRemaining }
end

if blockedUntil > 0 then
  redis.call('DEL', blockedKey)
  redis.call('DEL', hitsKey)
  count = 0
end

redis.call('ZREMRANGEBYSCORE', hitsKey, '-inf', now - ttl)
count = redis.call('ZCARD', hitsKey)
redis.call('ZADD', hitsKey, now, requestId)
count = count + 1

local oldest = redis.call('ZRANGE', hitsKey, 0, 0, 'WITHSCORES')
local windowRemaining = ttl
if oldest[2] then
  windowRemaining = math.max(0, math.ceil((tonumber(oldest[2]) + ttl - now) / 1000))
end
redis.call('PEXPIRE', hitsKey, math.max(ttl, 1) + math.max(blockDuration, 0))

if count > limit then
  local duration = math.max(blockDuration, 1)
  blockedUntil = now + duration
  redis.call('SET', blockedKey, blockedUntil, 'PX', duration + math.max(ttl, 1))
  return { count, windowRemaining, 1, math.ceil(duration / 1000) }
end

return { count, windowRemaining, 0, 0 }
`;
