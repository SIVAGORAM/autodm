import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DM_QUEUE } from './queue.constants';
import { createRedis } from './redis';

export const DM_QUEUE_TOKEN = 'DM_QUEUE_TOKEN';

@Global()
@Module({
  providers: [
    {
      provide: DM_QUEUE_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connection = createRedis(config.getOrThrow('REDIS_URL'));
        return new Queue(DM_QUEUE, {
          connection,
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        });
      },
    },
  ],
  exports: [DM_QUEUE_TOKEN],
})
export class QueueModule {}
