export const DM_QUEUE = 'dm';

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
  primarySentAt?: string;    // ISO time the primary DM was sent (for the 24h window)
}
