import { Worker } from 'bullmq';
import { createDmWorker } from './dm.worker';
import { createTokenRefreshWorker, scheduleTokenRefreshCron } from './token.worker';
import { logger } from '../utils/logger';

let workers: Worker[] = [];

export async function startWorkers(): Promise<void> {
  const dmWorker = createDmWorker();
  const tokenWorker = createTokenRefreshWorker();
  
  workers = [dmWorker, tokenWorker];
  logger.info(`Started ${workers.length} workers`);

  // Schedule cron tasks
  await scheduleTokenRefreshCron();
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map(w => w.close()));
  logger.info('All workers stopped');
}

