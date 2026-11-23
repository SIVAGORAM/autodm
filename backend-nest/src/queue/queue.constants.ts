import { createHash } from 'node:crypto';

export const DM_QUEUE = 'dm';
export const DM_QUEUE_TOKEN = 'DM_QUEUE_TOKEN';
export const COMMENT_PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const STANDARD_MESSAGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CLICK_TO_DIRECT_AD_MESSAGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type MessageWindowState = 'ELIGIBLE' | 'EXPIRED' | 'UNKNOWN';
export type MessageWindowType = 'STANDARD' | 'CLICK_TO_DIRECT_AD';

/** The longer window applies only to a verified Click-to-Direct ad entry event. */
export function messageWindowState(
  messageAt: string | number | Date | undefined,
  windowType: MessageWindowType = 'STANDARD',
  now = Date.now(),
): MessageWindowState {
  const timestamp = messageAt instanceof Date
    ? messageAt.getTime()
    : typeof messageAt === 'number'
      ? messageAt
      : typeof messageAt === 'string'
        ? Date.parse(messageAt)
        : Number.NaN;
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 5 * 60_000) return 'UNKNOWN';
  const windowMs = windowType === 'CLICK_TO_DIRECT_AD'
    ? CLICK_TO_DIRECT_AD_MESSAGE_WINDOW_MS
    : STANDARD_MESSAGE_WINDOW_MS;
  return now - timestamp >= windowMs ? 'EXPIRED' : 'ELIGIBLE';
}

/** Meta measures comment private-reply eligibility from comment creation, not webhook delivery. */
export function commentPrivateReplyWindowState(
  commentCreatedAt: string | number | Date | undefined,
  now = Date.now(),
): MessageWindowState {
  const timestamp = commentCreatedAt instanceof Date
    ? commentCreatedAt.getTime()
    : typeof commentCreatedAt === 'number'
      ? commentCreatedAt
      : typeof commentCreatedAt === 'string'
        ? Date.parse(commentCreatedAt)
        : Number.NaN;
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 5 * 60_000) return 'UNKNOWN';
  return now - timestamp >= COMMENT_PRIVATE_REPLY_WINDOW_MS ? 'EXPIRED' : 'ELIGIBLE';
}

/** Compatibility helper for callers that intentionally use the 24-hour window. */
export function standardMessageWindowState(messageAt: string | number | Date | undefined, now = Date.now()): MessageWindowState {
  return messageWindowState(messageAt, 'STANDARD', now);
}

export interface DmJob {
  automationId: string;
  igAccountId: string;
  triggerType: string;
  commentId?: string;        // for public reply + comment-DM
  commentCreatedAt?: string; // Authoritative timestamp fetched from the Meta comment node
  recipientIgsid: string;    // who receives the DM
  recipientUsername?: string;
  text: string;              // resolved DM text
  matchedKeyword?: string;
  triggerEventId: string;    // idempotency key (comment/message id)
  followUpId?: string;       // set when this job is a scheduled follow-up
  followUpOrder?: number;    // snapshot for customer-facing run history
  primarySentAt?: string;    // ISO time the primary DM was sent (also used for follow-up conditions)
  replyReceivedAt?: string;  // ISO time of an inbound DM/story reply or a comment-private-reply response
  messageWindow?: MessageWindowType; // set only from Meta's signed Click-to-Direct ad referral event
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
