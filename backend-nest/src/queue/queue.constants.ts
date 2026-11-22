import { createHash } from 'node:crypto';

export const DM_QUEUE = 'dm';
export const DM_QUEUE_TOKEN = 'DM_QUEUE_TOKEN';

export interface DmJob {
  automationId: string;
  igAccountId: string;
  triggerType: string;
  commentId?: string;        // for public reply + comment-DM
  recipientIgsid: string;    // who receives the DM
  recipientUsername?: string;
  text: string;              // resolved DM text
  matchedKeyword?: string;
  triggerEventId: string;    // idempotency key (comment/message id)
  followUpId?: string;       // set when this job is a scheduled follow-up
  followUpOrder?: number;    // snapshot for customer-facing run history
  primarySentAt?: string;    // ISO time the primary DM was sent (for the 24h window)
  replyReceivedAt?: string;  // ISO time the commenter replied to a comment private reply
}

export const COMMENT_FOLLOWUP_REPLY_REQUIRED = 'Instagram allows a follow-up to a comment private reply only after the commenter responds.';

export function runEventId(job: Pick<DmJob, 'triggerEventId' | 'followUpId'>): string {
  return job.followUpId ? `${job.triggerEventId}:fu:${job.followUpId}` : job.triggerEventId;
}

// BullMQ custom IDs must avoid its colon separator. Keep provider event IDs in
// the database and use this stable queue-safe representation for all sends.
export function dmQueueJobId(triggerEventId: string): string {
  return `dm-${createHash('sha256').update(triggerEventId).digest('hex')}`;
}
