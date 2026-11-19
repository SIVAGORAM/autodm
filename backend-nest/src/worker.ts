import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Queue } from 'bullmq';
import { AppModule } from './app.module';
import { DmProcessorService } from './queue/dm-processor.service';
import { DM_QUEUE, DmJob } from './queue/queue.constants';
import { createRedis } from './queue/redis';
import { TokenRefreshService } from './instagram/token-refresh.service';

// Standalone context: no HTTP server, just DI + the BullMQ worker loop.
async function bootstrap() {
  const log = new Logger('Worker');
  const appCtx = await NestFactory.createApplicationContext(AppModule);
  const processor = appCtx.get(DmProcessorService, { strict: false });
  const config = appCtx.get(ConfigService);
  const connection = createRedis(config.getOrThrow('REDIS_URL'));

  const worker = new Worker<DmJob>(DM_QUEUE, async (job) => {
    await processor.process(job.data);
  }, { connection, concurrency: 10 });

  worker.on('completed', (job) => log.debug(`job ${job.id} done`));
  worker.on('failed', (job, err) => log.warn(`job ${job?.id} failed: ${err.message}`));
  log.log('DM worker started (concurrency=10)');

  // Daily maintenance: refresh Instagram tokens before they expire (60-day limit).
  const tokenRefresh = appCtx.get(TokenRefreshService, { strict: false });
  const maintQueue = new Queue('maintenance', { connection: createRedis(config.getOrThrow('REDIS_URL')) });
  await maintQueue.add('refresh-tokens', {}, { repeat: { pattern: '0 3 * * *' }, jobId: 'refresh-tokens' });
  new Worker('maintenance', async () => {
    const r = await tokenRefresh.refreshExpiring(7);
    log.log(`maintenance: tokens ${r.refreshed}/${r.checked}`);
  }, { connection: createRedis(config.getOrThrow('REDIS_URL')), concurrency: 1 });
  log.log('Maintenance worker started (daily token refresh)');
}
bootstrap();
