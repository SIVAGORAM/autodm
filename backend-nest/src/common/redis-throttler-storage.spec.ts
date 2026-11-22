import IORedis from 'ioredis';
import { REDIS_THROTTLE_SCRIPT, RedisThrottlerStorage } from './redis-throttler-storage';

const mockRedis = { eval: jest.fn(), on: jest.fn(), quit: jest.fn(), disconnect: jest.fn() };
jest.mock('ioredis', () => jest.fn(() => mockRedis));

describe('RedisThrottlerStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses an atomic Redis script and returns the throttler storage record', async () => {
    mockRedis.eval.mockResolvedValue([3, 42, 0, 0]);
    const storage = new RedisThrottlerStorage('redis://localhost:6379');

    await expect(storage.increment('ip:203.0.113.12:/api/login', 60_000, 10, 60_000, 'default'))
      .resolves.toEqual({ totalHits: 3, timeToExpire: 42, isBlocked: false, timeToBlockExpire: 0 });

    expect(IORedis).toHaveBeenCalledWith('redis://localhost:6379', expect.objectContaining({
      maxRetriesPerRequest: 0, enableOfflineQueue: false,
    }));
    const [script, keyCount, hitsKey, blockedKey] = mockRedis.eval.mock.calls[0];
    expect(script).toBe(REDIS_THROTTLE_SCRIPT);
    expect(keyCount).toBe(2);
    expect(hitsKey).toMatch(/^heylaunch:http-throttle:[a-f0-9]{64}:hits$/);
    expect(blockedKey).toBe(hitsKey.replace(/:hits$/, ':blocked'));
    expect(hitsKey).not.toContain('203.0.113.12');
  });

  it('fails closed if Redis returns an invalid result', async () => {
    mockRedis.eval.mockResolvedValue(['not-a-count']);
    const storage = new RedisThrottlerStorage('redis://localhost:6379');
    await expect(storage.increment('client:/api', 60_000, 10, 60_000, 'default'))
      .rejects.toThrow('Redis returned an invalid HTTP throttle result.');
  });

  it('uses an atomic sliding window and keeps a bounded block marker', () => {
    expect(REDIS_THROTTLE_SCRIPT).toContain("redis.call('ZREMRANGEBYSCORE'");
    expect(REDIS_THROTTLE_SCRIPT).toContain("redis.call('SET', blockedKey, blockedUntil, 'PX'");
  });

  it('closes the Redis connection during application shutdown', async () => {
    mockRedis.quit.mockResolvedValue('OK');
    const storage = new RedisThrottlerStorage('redis://localhost:6379');
    await storage.onApplicationShutdown();
    expect(mockRedis.quit).toHaveBeenCalledTimes(1);
  });

  it('forces the Redis connection closed if graceful shutdown fails', async () => {
    mockRedis.quit.mockRejectedValue(new Error('redis unavailable'));
    const storage = new RedisThrottlerStorage('redis://localhost:6379');
    await expect(storage.onApplicationShutdown()).resolves.toBeUndefined();
    expect(mockRedis.disconnect).toHaveBeenCalledTimes(1);
  });
});
