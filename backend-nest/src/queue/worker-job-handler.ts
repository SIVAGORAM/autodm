import type { Job } from 'bullmq';
import type { WebhookService } from '../webhook/webhook.service';
import type { DmProcessorService } from './dm-processor.service';
import type { DmJob } from './queue.constants';

const SUPPORTED_TRIGGER_TYPES = new Set(['POST_COMMENT', 'ANY_POST', 'LIVE_COMMENT', 'STORY_REPLY', 'DM']);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDmJob(value: unknown): value is DmJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const job = value as Partial<DmJob>;
  if (!isNonEmptyString(job.automationId) || !isNonEmptyString(job.igAccountId) ||
      !isNonEmptyString(job.triggerType) || !SUPPORTED_TRIGGER_TYPES.has(job.triggerType) ||
      !isNonEmptyString(job.recipientIgsid) || typeof job.text !== 'string' ||
      !isNonEmptyString(job.triggerEventId)) return false;

  for (const optionalString of [job.commentId, job.commentCreatedAt, job.recipientUsername,
    job.matchedKeyword, job.followUpId, job.primarySentAt, job.replyReceivedAt]) {
    if (optionalString !== undefined && typeof optionalString !== 'string') return false;
  }
  if (job.followUpOrder !== undefined && (!Number.isInteger(job.followUpOrder) || job.followUpOrder < 0)) return false;
  if (job.messageWindow !== undefined && job.messageWindow !== 'STANDARD' && job.messageWindow !== 'CLICK_TO_DIRECT_AD') return false;
  return true;
}

/** Shared dispatch used by the production worker and isolated queue smoke tests. */
export async function processDmQueueJob(
  job: Job,
  webhookProcessor: Pick<WebhookService, 'processEvent'>,
  dmProcessor: Pick<DmProcessorService, 'process'>,
): Promise<void> {
  if (job.name === 'process-webhook-event') {
    const webhookEventId = job.data?.webhookEventId;
    if (typeof webhookEventId !== 'string' || webhookEventId.length === 0) {
      job.discard();
      throw new Error('Invalid process-webhook-event job payload');
    }
    await webhookProcessor.processEvent(webhookEventId);
    return;
  }

  if (job.name !== 'send') {
    // This queue is shared by only the webhook dispatcher and DM sender. Do
    // not let an unknown or stale job name fall through into provider sends.
    job.discard();
    throw new Error(`Unsupported DM queue job: ${job.name}`);
  }

  if (!isDmJob(job.data)) {
    job.discard();
    throw new Error('Invalid send job payload');
  }

  await dmProcessor.process(job.data as DmJob, job as Job<DmJob>);
}
