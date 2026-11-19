import IORedis from 'ioredis';

// One shared connection factory. BullMQ needs maxRetriesPerRequest: null.
export function createRedis(url: string): IORedis {
  return new IORedis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
}
