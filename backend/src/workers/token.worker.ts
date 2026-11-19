// src/workers/token.worker.ts
import { Worker, Job } from 'bullmq';
import { bullMQConnection } from '../configs/redis';
import { prisma } from '../lib/prisma';
import { instagramService } from '../services/instagram.service';
import { tokenRefreshQueue, QUEUE_NAMES } from '../queues';
import { logger } from '../utils/logger';

interface TokenRefreshJobData {
  type: 'bulk-check' | 'single-refresh';
  instagramAccountId?: string;
}

const REFRESH_THRESHOLD_DAYS = 15;

async function processTokenRefreshJob(job: Job<TokenRefreshJobData>): Promise<void> {
  const { type, instagramAccountId } = job.data;

  if (type === 'bulk-check') {
    logger.info('Starting bulk token refresh check');
    const ThresholdDate = new Date();
    ThresholdDate.setDate(ThresholdDate.getDate() + REFRESH_THRESHOLD_DAYS);

    const accountsToRefresh = await prisma.instagramAccount.findMany({
      where: {
        isActive: true,
        tokenExpiresAt: {
          lte: ThresholdDate,
        },
      },
      select: { id: true, username: true },
    });

    logger.info(`Found ${accountsToRefresh.length} accounts requiring token refresh`);

    for (const account of accountsToRefresh) {
      // Enqueue single-refresh job for safe concurrency handles
      await tokenRefreshQueue.add(
        `refresh-${account.id}`,
        { type: 'single-refresh', instagramAccountId: account.id },
        { jobId: `refresh:${account.id}:${Date.now()}` }
      );
    }
  } else if (type === 'single-refresh' && instagramAccountId) {
    logger.info(`Refreshing token for account ${instagramAccountId}`);
    try {
      await instagramService.refreshLongLivedToken(instagramAccountId);
      logger.info(`Successfully refreshed token for account ${instagramAccountId}`);
    } catch (error: any) {
      logger.error(`Failed to refresh token for account ${instagramAccountId}:`, error.message);
      throw error; // Let BullMQ retry
    }
  }
}

export function createTokenRefreshWorker(): Worker {
  const worker = new Worker<TokenRefreshJobData>(QUEUE_NAMES.TOKEN_REFRESH, processTokenRefreshJob, {
    connection: bullMQConnection as any,
    concurrency: 5, // low concurrency is safe for this periodic upkeep
  });

  worker.on('completed', (job) => logger.debug(`Token job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Token job ${job?.id} failed:`, err.message));
  worker.on('error', (err) => logger.error('Token Worker Error:', err));

  logger.info('Token refresh worker started');
  return worker;
}

export async function scheduleTokenRefreshCron(): Promise<void> {
  // Remove existing repeatable jobs to avoid duplicates on restarts
  const repeatableJobs = await tokenRefreshQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await tokenRefreshQueue.removeRepeatableByKey(job.key);
  }

  // Add daily check at midnight
  await tokenRefreshQueue.add(
    'bulk-refresh-check',
    { type: 'bulk-check' },
    {
      repeat: { pattern: '0 0 * * *' }, // Daily at midnight
      removeOnComplete: true,
      removeOnFail: { count: 30 },
    }
  );
  
  logger.info('Token refresh CRON scheduled (Daily at 00:00)');
  
  // Optionally trigger an immediate check on startup
  await tokenRefreshQueue.add('bulk-refresh-check-startup', { type: 'bulk-check' }, { removeOnComplete: true });
}
