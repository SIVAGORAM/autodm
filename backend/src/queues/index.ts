// src/queues/index.ts
import { Queue, QueueEvents } from 'bullmq';
import { bullMQConnection } from '../configs/redis';
import { logger } from '../utils/logger';

export const QUEUE_NAMES = {
  DM_PROCESSING: 'dm-processing',
  DM_DEAD_LETTER: 'dm-dead-letter',
  TOKEN_REFRESH: 'token-refresh',
} as const;

// Main DM processing queue
export const dmQueue = new Queue(QUEUE_NAMES.DM_PROCESSING, {
  connection: bullMQConnection as any,

  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: { count: 1000, age: 24 * 3600 },
    removeOnFail: { count: 5000, age: 7 * 24 * 3600 },
  },
});

// Dead letter queue - manual review
export const dmDeadLetterQueue = new Queue(QUEUE_NAMES.DM_DEAD_LETTER, {
  connection: bullMQConnection as any,

  defaultJobOptions: {
    removeOnComplete: false, // Keep forever for review
    removeOnFail: false,
  },
});

// Token refresh queue
export const tokenRefreshQueue = new Queue(QUEUE_NAMES.TOKEN_REFRESH, {
  connection: bullMQConnection as any,

  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: { count: 100 },
  },
});

// Queue event monitoring
const dmQueueEvents = new QueueEvents(QUEUE_NAMES.DM_PROCESSING, { connection: bullMQConnection as any });

dmQueueEvents.on('completed', ({ jobId }) => logger.debug(`DM job ${jobId} completed`));
dmQueueEvents.on('failed', ({ jobId, failedReason }) => logger.error(`DM job ${jobId} failed: ${failedReason}`));

export interface DmJobData {
  commentEventId: string;
  campaignId: string;
  instagramAccountId: string;
  commentorId: string;
  commentorUsername: string;
  messageTemplate: string;
  requireFollower: boolean;
  postId: string;
}

export async function enqueueDmJob(data: DmJobData): Promise<void> {
  const jobId = `dm:${data.commentEventId}`; // Idempotent job ID
  await dmQueue.add('process-dm', data, { jobId, deduplication: { id: data.commentEventId } });
}
