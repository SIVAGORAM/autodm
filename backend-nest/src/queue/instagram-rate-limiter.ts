import { randomUUID } from 'node:crypto';
import { DelayedError, Job, Queue } from 'bullmq';
import { DmJob } from './queue.constants';

// Meta currently documents 750 post/reel private replies per account per hour.
// Keep 50 slots for sends made outside HeyLaunch or during config propagation.
const PRIVATE_REPLY_LIMIT = 700;
const PRIVATE_REPLY_WINDOW_MS = 60 * 60 * 1000;

const reserveScript = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local member = ARGV[3]
local time = redis.call('TIME')
local now = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return math.max(1, tonumber(oldest[2]) + window - now)
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return 0
`;

interface RedisEvalClient {
  eval(script: string, numberOfKeys: number, ...args: (string | number)[]): Promise<number | string>;
}

/** Atomically reserves one account-scoped private-reply slot across all workers. */
export async function reserveCommentPrivateReply(queue: Queue, job: Job<DmJob>, token?: string): Promise<void> {
  const redis = await queue.client as unknown as RedisEvalClient;
  const waitMs = Number(await redis.eval(
    reserveScript,
    1,
    `heylaunch:meta:private-replies:${job.data.igAccountId}`,
    PRIVATE_REPLY_LIMIT,
    PRIVATE_REPLY_WINDOW_MS,
    randomUUID(),
  ));

  if (waitMs <= 0) return;
  if (!token) throw new Error('Cannot defer a rate-limited job without its BullMQ lock token.');

  await job.moveToDelayed(Date.now() + waitMs, token);
  throw new DelayedError();
}
