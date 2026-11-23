import IORedis from 'ioredis';

// One shared connection factory. BullMQ needs maxRetriesPerRequest: null.
export function createRedis(url: string): IORedis {
  return new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

/** BullMQ queues can lose jobs if Redis evicts their keys under memory pressure. */
export async function hasNoevictionPolicy(client: { info(section: string): Promise<string> }): Promise<boolean> {
  const info = await client.info('memory');
  const policy = info.split(/\r?\n/).find((line) => line.startsWith('maxmemory_policy:'))?.slice('maxmemory_policy:'.length).trim();
  return policy === 'noeviction';
}

export async function assertRedisNoeviction(client: { info(section: string): Promise<string> }): Promise<void> {
  if (!await hasNoevictionPolicy(client)) throw new Error('Redis maxmemory_policy must be noeviction for BullMQ durability.');
}
