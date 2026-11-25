import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { DM_QUEUE, DM_QUEUE_TOKEN } from './queue.constants';
import { createRedis } from './redis';
import {
  WORKER_HEARTBEAT_INTERVAL_MS,
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SECONDS,
  hasFreshWorkerHeartbeat,
} from './worker-health';
import { DmProcessorService } from './dm-processor.service';
import { WebhookService } from '../webhook/webhook.service';
import { processDmQueueJob } from './worker-job-handler';
import { safeErrorLabel } from '../common/safe-error-label';

@Injectable()
export class InProcessWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(InProcessWorkerService.name);
  private worker: Worker | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connection: any = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(DM_QUEUE_TOKEN) private readonly dmQueue: Queue,
    private readonly dmProcessor: DmProcessorService,
    private readonly webhookService: WebhookService,
  ) {}

  async onApplicationBootstrap() {
    // In unit test environment, don't auto-start unless explicitly requested
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_IN_PROCESS_WORKER !== 'true') {
      return;
    }

    const enabled = this.config.get<string>('ENABLE_IN_PROCESS_WORKER', 'true') !== 'false';
    if (!enabled) {
      this.log.log('In-process worker is disabled via configuration.');
      return;
    }

    try {
      // Check if an external dedicated worker is already running and active
      const hasExternalWorker = await hasFreshWorkerHeartbeat(this.dmQueue);
      if (hasExternalWorker) {
        this.log.log('External delivery worker detected. In-process worker in standby mode.');
        return;
      }

      const redisUrl = this.config.get<string>('REDIS_URL');
      if (!redisUrl) return;

      this.connection = createRedis(redisUrl);

      const refreshHeartbeat = async () => {
        try {
          await this.connection.set(
            WORKER_HEARTBEAT_KEY,
            String(Date.now()),
            'EX',
            WORKER_HEARTBEAT_TTL_SECONDS,
          );
        } catch (err) {
          this.log.warn(`Heartbeat update failed: ${safeErrorLabel(err)}`);
        }
      };

      await refreshHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        void refreshHeartbeat();
      }, WORKER_HEARTBEAT_INTERVAL_MS);
      this.heartbeatTimer.unref();

      this.worker = new Worker(
        DM_QUEUE,
        async (job) => {
          await processDmQueueJob(job, this.webhookService, this.dmProcessor);
        },
        { connection: this.connection, concurrency: 5 },
      );

      this.worker.on('completed', (job) => {
        this.log.debug(`Job ${job.id} completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        this.log.warn(`Job ${job?.id} failed: ${safeErrorLabel(err)}`);
      });

      this.log.log('In-process delivery worker started successfully (concurrency: 5).');
    } catch (err) {
      this.log.warn(`Could not start in-process delivery worker: ${safeErrorLabel(err)}`);
    }
  }

  async onApplicationShutdown() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.connection) {
      try {
        await this.connection.quit();
      } catch {
        this.connection.disconnect();
      }
      this.connection = null;
    }
  }
}
