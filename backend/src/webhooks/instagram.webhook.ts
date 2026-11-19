// src/webhooks/instagram.webhook.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../configs/env';
import { cache } from '../configs/redis';
import { prisma } from '../lib/prisma';
import { enqueueDmJob } from '../queues';
import { logger } from '../utils/logger';

// ─── Webhook verification (GET - Facebook hub challenge) ─────────
export async function verifyWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    logger.info('Instagram webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('Webhook verification failed');
    res.status(403).send('Verification failed');
  }
}

// ─── Webhook event receiver (POST) ───────────────────────────────
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  // Always respond 200 first to prevent Instagram retries
  res.status(200).send('EVENT_RECEIVED');

  try {
    // Verify Instagram signature
    const rawBody = req.body as Buffer;
    const signature = req.headers['x-hub-signature-256'] as string;

    if (!verifySignature(rawBody, signature)) {
      logger.warn('Invalid webhook signature - ignoring event');
      return;
    }

    const body = JSON.parse(rawBody.toString());

    if (body.object !== 'instagram') return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'comments') {
          await handleCommentEvent(change.value);
        }
      }
    }
  } catch (error) {
    logger.error('Webhook processing error:', error);
  }
}

async function handleCommentEvent(eventData: any): Promise<void> {
  const {
    id: instagramCommentId,
    text: commentText,
    from,
    media,
    timestamp,
  } = eventData;

  if (!instagramCommentId || !from?.id) {
    logger.debug('Incomplete comment event, skipping');
    return;
  }

  // ─── Idempotency: skip already-processed events ──────────────
  const isNew = await cache.setIdempotencyKey(`webhook:comment:${instagramCommentId}`);
  if (!isNew) {
    logger.debug(`Duplicate comment event ${instagramCommentId}, skipping`);
    return;
  }

  const commentorId = from.id;
  const commentorUsername = from.username || 'unknown';
  const mediaId = media?.id;

  if (!mediaId) {
    logger.debug('No media ID in comment event');
    return;
  }

  // ─── Find which post + campaign this belongs to ───────────────
  const post = await prisma.post.findUnique({
    where: { instagramPostId: mediaId, isActive: true },
    include: {
      campaign: {
        select: {
          id: true,
          status: true,
          requireFollower: true,
          messageTemplate: true,
          keywords: true,
        },
      },
      instagramAccount: { select: { id: true } },
    },
  });

  if (!post || !post.campaign || post.campaign.status !== 'ACTIVE') {
    logger.debug(`No active campaign for media ${mediaId}`);
    return;
  }

  const campaign = post.campaign;

  // ─── Keyword filtering (if campaign has keywords) ─────────────
  if (campaign.keywords.length > 0) {
    const lowerComment = commentText?.toLowerCase() ?? '';
    const matches = campaign.keywords.some((kw: string) => lowerComment.includes(kw.toLowerCase()));
    if (!matches) {
      logger.debug(`Comment doesn't match keywords for campaign ${campaign.id}`);
      return;
    }
  }

  // ─── Don't DM the account owner ──────────────────────────────
  if (commentorId === post.instagramAccount.id) return;

  // ─── Store comment event ──────────────────────────────────────
  let commentEvent;
  try {
    commentEvent = await prisma.commentEvent.create({
      data: {
        campaignId: campaign.id,
        postId: post.id,
        instagramCommentId,
        commentorId,
        commentorUsername,
        commentText: commentText ?? '',
        status: 'PENDING',
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      // Duplicate instagramCommentId - already stored
      logger.debug(`Comment ${instagramCommentId} already exists in DB`);
      return;
    }
    throw error;
  }

  // ─── Enqueue DM job ───────────────────────────────────────────
  await enqueueDmJob({
    commentEventId: commentEvent.id,
    campaignId: campaign.id,
    instagramAccountId: post.instagramAccount.id,
    commentorId,
    commentorUsername,
    messageTemplate: campaign.messageTemplate,
    requireFollower: campaign.requireFollower,
    postId: post.id,
  });

  logger.info(`Comment event queued: ${commentorUsername} on post ${mediaId}`);
}

function verifySignature(rawBody: Buffer, signature: string): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = crypto
    .createHmac('sha256', env.INSTAGRAM_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  const received = signature.slice(7);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
