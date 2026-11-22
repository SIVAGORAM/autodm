const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { RedisThrottlerStorage } = require('../dist/common/redis-throttler-storage');

async function main() {
  if (process.env.THROTTLER_REDIS_SMOKE !== 'true') {
    throw new Error('Set THROTTLER_REDIS_SMOKE=true to run this isolated Redis integration check.');
  }
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for the Redis throttler integration check.');
  const redisUrl = new URL(process.env.REDIS_URL);
  if (redisUrl.protocol !== 'redis:' || !['localhost', '127.0.0.1', '[::1]'].includes(redisUrl.hostname)) {
    throw new Error('The integration check only runs against an isolated local Redis service.');
  }
  const storage = new RedisThrottlerStorage(process.env.REDIS_URL);
  const tracker = `ci-${randomUUID()}`;

  try {
    const first = await storage.increment(`${tracker}:blocked`, 10_000, 2, 250, 'smoke');
    const second = await storage.increment(`${tracker}:blocked`, 10_000, 2, 250, 'smoke');
    const third = await storage.increment(`${tracker}:blocked`, 10_000, 2, 250, 'smoke');
    const fourth = await storage.increment(`${tracker}:blocked`, 10_000, 2, 250, 'smoke');
    assert.equal(first.isBlocked, false);
    assert.equal(second.isBlocked, false);
    assert.equal(third.isBlocked, true);
    assert.equal(fourth.isBlocked, true);
    assert.equal(third.totalHits, 3);
    const isolated = await storage.increment(`${tracker}:other`, 10_000, 2, 250, 'smoke');
    assert.equal(isolated.totalHits, 1, 'different trackers must not share counters');
    assert.equal(isolated.isBlocked, false);

    await new Promise((resolve) => setTimeout(resolve, 300));
    const afterBlock = await storage.increment(`${tracker}:blocked`, 10_000, 2, 250, 'smoke');
    assert.equal(afterBlock.isBlocked, false);
    assert.equal(afterBlock.totalHits, 1, 'expired block must reset the bucket');

    const slidingKey = `${tracker}:sliding`;
    const slidingFirst = await storage.increment(slidingKey, 1_000, 2, 1_000, 'smoke');
    await new Promise((resolve) => setTimeout(resolve, 600));
    const slidingSecond = await storage.increment(slidingKey, 1_000, 2, 1_000, 'smoke');
    await new Promise((resolve) => setTimeout(resolve, 450));
    const slidingThird = await storage.increment(slidingKey, 1_000, 2, 1_000, 'smoke');
    assert.equal(slidingFirst.totalHits, 1);
    assert.equal(slidingSecond.totalHits, 2);
    assert.equal(slidingThird.totalHits, 2, 'expired hits must leave the sliding window');
    assert.equal(slidingThird.isBlocked, false);

    const concurrentKey = `${tracker}:concurrent`;
    const concurrent = await Promise.all(Array.from({ length: 10 }, () =>
      storage.increment(concurrentKey, 10_000, 5, 10_000, 'smoke')));
    assert.equal(concurrent.filter((item) => !item.isBlocked).length, 5);
    assert.equal(concurrent.filter((item) => item.isBlocked).length, 5);
    assert.ok(concurrent.every((item) => item.totalHits === 6), 'atomic requests must share one blocked count');

    console.log('Redis throttler integration check passed: block, reset, sliding expiry, and concurrency.');
  } finally {
    await storage.onApplicationShutdown();
  }
}

main().catch((error) => {
  console.error('Redis throttler integration check failed.');
  process.exitCode = 1;
});
