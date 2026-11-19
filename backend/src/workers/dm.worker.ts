// src/workers/dm.worker.ts
import { Worker, Job } from 'bullmq';
import { bullMQConnection } from '../configs/redis';
import { prisma } from '../lib/prisma';
import { cache } from '../configs/redis';
import { instagramService } from '../services/instagram.service';
import { dmDeadLetterQueue, DmJobData, QUEUE_NAMES } from '../queues';
import { logger } from '../utils/logger';

const DAILY_DM_LIMIT_WINDOW = 86400;

async function processDmJob(job: Job<DmJobData>): Promise<void> {
  const { commentEventId, campaignId, instagramAccountId, commentorId, commentorUsername, messageTemplate, requireFollower } = job.data;

  logger.debug(`Processing DM job for comment ${commentEventId}`);

  await prisma.commentEvent.update({ where: { id: commentEventId }, data: { status: 'PROCESSING' } });

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { dailyLimit: true, status: true } });
  if (!campaign || campaign.status !== 'ACTIVE') {
    await prisma.commentEvent.update({ where: { id: commentEventId }, data: { status: 'SKIPPED', processedAt: new Date() } });
    return;
  }

  const { allowed } = await cache.rateLimitCheck(`campaign_dm_count:${campaignId}`, campaign.dailyLimit, DAILY_DM_LIMIT_WINDOW);
  if (!allowed) {
    logger.warn(`Campaign ${campaignId} hit daily DM limit`);
    await prisma.commentEvent.update({ where: { id: commentEventId }, data: { status: 'SKIPPED', processedAt: new Date() } });
    return;
  }

  if (requireFollower) {
    const isFollower = await instagramService.isFollower(instagramAccountId, commentorId);
    if (!isFollower) {
      await prisma.commentEvent.update({ where: { id: commentEventId }, data: { status: 'SKIPPED', processedAt: new Date() } });
      return;
    }
  }

  const recentDmKey = `dm_sent:${campaignId}:${commentorId}`;
  const alreadySent = await cache.exists(recentDmKey);
  if (alreadySent) {
    await prisma.commentEvent.update({ where: { id: commentEventId }, data: { status: 'SKIPPED', processedAt: new Date() } });
    return;
  }

  const message = messageTemplate.replace(/\{\{(\w+)\}\}/g, (_, k) => (({ username: commentorUsername } as Record<string, string>)[k] ?? ''));

  try {
    await instagramService.sendDM(instagramAccountId, commentorId, message);
    await cache.set(recentDmKey, '1', DAILY_DM_LIMIT_WINDOW);

    await prisma.$transaction([
      prisma.commentEvent.update({ where: { id: commentEventId }, data: { status: 'DM_SENT', processedAt: new Date() } }),
      prisma.dmLog.create({ data: { instagramAccountId, commentEventId, recipientId: commentorId, recipientUsername: commentorUsername, message, status: 'SENT', sentAt: new Date() } }),
    ]);

    logger.info(`DM sent to ${commentorUsername} | Campaign: ${campaignId}`);
  } catch (error: any) {
    await prisma.$transaction([
      prisma.commentEvent.update({ where: { id: commentEventId }, data: { status: 'FAILED', processedAt: new Date() } }),
      prisma.dmLog.create({ data: { instagramAccountId, commentEventId, recipientId: commentorId, recipientUsername: commentorUsername, message, status: 'FAILED', errorMessage: error.message, sentAt: new Date() } }),
    ]);
    throw error;
  }
}

export function createDmWorker(): Worker {
  const worker = new Worker<DmJobData>(QUEUE_NAMES.DM_PROCESSING, processDmJob, {
    connection: bullMQConnection as any,
    concurrency: 10,
    limiter: { max: 50, duration: 1000 },
  });

  worker.on('completed', (job) => logger.debug(`Job ${job.id} completed`));
  worker.on('failed', async (job, err) => {
    if (!job) return;
    logger.error(`Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await dmDeadLetterQueue.add('failed-dm', { ...job.data, error: err.message });
      logger.warn(`Job ${job.id} moved to dead letter queue`);
    }
  });
  worker.on('error', (err) => logger.error('Worker error:', err));
  logger.info('DM worker started');
  return worker;
}
