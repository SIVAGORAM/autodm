import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DM_QUEUE, DM_QUEUE_TOKEN } from './queue.constants';
import { createRedis } from './redis';
import { DashboardEventsService } from './dashboard-events.service';

@Injectable()
export class QueueShutdown implements OnApplicationShutdown {
  constructor(@Inject(DM_QUEUE_TOKEN) private readonly queue: Queue) {}

  async onApplicationShutdown() {
    await this.queue.close();
  }
}

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
    QueueShutdown,
    DashboardEventsService,
  ],
  exports: [DM_QUEUE_TOKEN, DashboardEventsService],
})
export class QueueModule {}
