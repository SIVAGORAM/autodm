import { ConflictException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DM_QUEUE_TOKEN } from '../queue/queue.constants';
import { COMMENT_FOLLOWUP_REPLY_REQUIRED, DmJob, dmQueueJobId } from '../queue/queue.constants';
import { matchComment, MatchMode } from '../automations/matcher';
import { accountPlanRestriction, planFor } from '../common/plan.util';
import { automationRestriction } from '../common/automation-entitlement';
import { DmQuotaService } from '../common/dm-quota.service';
import { safeErrorLabel } from '../common/safe-error-label';
import { DashboardEventsService } from '../queue/dashboard-events.service';
import { InstagramService } from '../instagram/instagram.service';
import { EncryptionService } from '../common/encryption.service';

function commentValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value && typeof value === 'object' ? [value] : [];
}

function normalizeCommentValue(value: any): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = value.id ?? value.comment_id;
  if (typeof id !== 'string' && typeof id !== 'number') return null;
  return { ...value, id: String(id), media: value.media ?? (value.media_id ? { id: String(value.media_id) } : undefined) };
}

type AutomationOrderFields = { id: string; createdAt: Date };

function createdAutomationOrder(left: AutomationOrderFields, right: AutomationOrderFields): number {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}

// Handles durable Instagram webhook events. The HTTP endpoint persists the
// event before acknowledging Meta; this worker resolves matched comment
// metadata before it enqueues a private reply.
@Injectable()
export class WebhookService {
  private readonly log = new Logger(WebhookService.name);
  private static readonly INVALID_SIGNATURE_WINDOW_SECONDS = 60;
  private static readonly INVALID_SIGNATURE_LIMIT = 30;
  constructor(
    private prisma: PrismaService,
    @Inject(DM_QUEUE_TOKEN) private dmQueue: Queue,
    private quota: DmQuotaService,
    private dashboardEvents: DashboardEventsService,
    private readonly instagram: InstagramService,
    private readonly encryption: EncryptionService,
  ) {}

  // Apply an abuse limit only after signature verification fails. The generic
  // per-IP throttle remains disabled for this endpoint because Meta shares
  // sender IPs across creators. Store only a short-lived hash of the source IP.
  async shouldThrottleInvalidSignature(sourceIp: string): Promise<boolean> {
    const key = `webhook:invalid-signature:${createHash('sha256').update(sourceIp || 'unknown').digest('hex')}`;
    const script = `
      local attempts = redis.call('INCR', KEYS[1])
      if attempts == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      return attempts
    `;

    try {
      const redis = await this.dmQueue.client as unknown as {
        eval: (lua: string, numberOfKeys: number, ...args: string[]) => Promise<unknown>;
      };
      const attempts = Number(await redis.eval(script, 1, key, String(WebhookService.INVALID_SIGNATURE_WINDOW_SECONDS)));
      return attempts > WebhookService.INVALID_SIGNATURE_LIMIT;
    } catch (error) {
      // Signature failure still returns 401 if Redis is unavailable; only the
      // additional abuse throttling is unavailable in that case.
      this.log.warn(`Invalid-signature throttle unavailable: ${safeErrorLabel(error)}`);
      return false;
    }
  }

  // Persist individual provider events before the HTTP endpoint acknowledges
  // Meta. The database row is the retry source if queue submission fails.
  async accept(payload: any): Promise<void> {
    const events: Array<{ eventId: string; igUserId: string; payload: object }> = [];
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const igUserId = typeof entry?.id === 'string' ? entry.id : '';
      if (!igUserId) continue;

      for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
        if (change?.field !== 'comments') continue;
        for (const candidate of commentValues(change.value)) {
          const value = normalizeCommentValue(candidate);
          if (!value) continue;
          const eventId = `comment:${igUserId}:${value.id}`;
          events.push({ eventId, igUserId, payload: { entry: [{ id: igUserId, changes: [{ ...change, value }] }] } });
        }
      }
      for (const message of Array.isArray(entry.messaging) ? entry.messaging : []) {
        if (!message?.message?.mid) continue;
        const eventId = `message:${igUserId}:${String(message.message.mid)}`;
        events.push({ eventId, igUserId, payload: { entry: [{ id: igUserId, messaging: [message] }] } });
      }
    }

    const uniqueEvents = [...new Map(events.map((event) => [event.eventId, event])).values()];
    if (!uniqueEvents.length) return;

    const accounts = await this.prisma.igAccount.findMany({
      where: { igUserId: { in: [...new Set(uniqueEvents.map((event) => event.igUserId))] }, isActive: true },
      select: { id: true, igUserId: true },
    });
    const accountIds = new Map(accounts.map((account) => [account.igUserId, account.id]));
    const linkedEvents = uniqueEvents.filter((event) => accountIds.has(event.igUserId));
    if (!linkedEvents.length) return;

    // Persist the whole provider batch in one database write before ACK.
    await this.prisma.webhookEvent.createMany({
      data: linkedEvents.map((event) => ({
        eventId: event.eventId,
        igUserId: event.igUserId,
        igAccountId: accountIds.get(event.igUserId)!,
        payload: event.payload as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
    const stored = await this.prisma.webhookEvent.findMany({
      where: { eventId: { in: linkedEvents.map((event) => event.eventId) } },
      select: { id: true, eventId: true, payload: true, processedAt: true, deadLetterAt: true, nextAttemptAt: true },
    });
    const now = new Date();
    const pending = stored.filter((event) =>
      !event.processedAt && !event.deadLetterAt && !!event.payload && (!event.nextAttemptAt || event.nextAttemptAt <= now),
    );
    await this.enqueueEvents(pending);
  }

  // Reconcile the durable receipt table with Redis after transient queue
  // failures or Redis data loss. BullMQ remains the fast path; Postgres is the
  // recovery source until each event is processed.
  async enqueuePending(limit = 50): Promise<number> {
    const now = new Date();
    const pending = await this.prisma.webhookEvent.findMany({
      where: {
        processedAt: null,
        deadLetterAt: null,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return this.enqueueEvents(pending.filter((event) => !!event.payload));
  }

  async listDeadLetters(page = 1, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.webhookEvent.findMany({
      where: { deadLetterAt: { not: null }, processedAt: null },
      orderBy: [{ deadLetterAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      skip: (Math.min(Math.max(page, 1), 100_000) - 1) * take,
      select: {
        id: true, eventId: true, attempts: true, redriveCount: true, lastError: true,
        createdAt: true, deadLetterAt: true, lastRedrivenAt: true, payloadPurgedAt: true,
        igAccount: { select: { username: true } },
      },
    });
    return {
      page: Math.min(Math.max(page, 1), 100_000),
      events: rows.slice(0, take).map((event: typeof rows[number]) => ({
        id: event.id,
        type: event.eventId.startsWith('comment:') ? 'comment' : 'message',
        attempts: event.attempts,
        redriveCount: event.redriveCount,
        payloadAvailable: !event.payloadPurgedAt,
        errorSummary: event.lastError ? 'Processing failed; inspect redacted worker logs.' : null,
        createdAt: event.createdAt,
        deadLetterAt: event.deadLetterAt,
        lastRedrivenAt: event.lastRedrivenAt,
        instagramAccount: event.igAccount?.username ?? null,
      })),
      hasMore: rows.length > take,
    };
  }

  async redriveDeadLetter(id: string, adminUserId: string, reason: string) {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id },
      select: {
        id: true, eventId: true, payload: true, attempts: true,
        processedAt: true, deadLetterAt: true, redriveCount: true, payloadPurgedAt: true,
          igAccount: { select: { isActive: true, user: { select: { deletionRequestedAt: true, suspendedAt: true } } } },
      },
    });
    if (!event) throw new NotFoundException('Dead-letter event not found.');
    if (!event.deadLetterAt || event.processedAt || !event.payload || event.payloadPurgedAt) {
      throw new ConflictException('This event is no longer eligible for redrive.');
    }
      if (!event.igAccount?.isActive || event.igAccount.user.deletionRequestedAt || event.igAccount.user.suspendedAt) {
      throw new ConflictException('The connected Instagram account is unavailable.');
    }

    const jobId = `wh-${createHash('sha256').update(event.eventId).digest('hex')}`;
    const existing = await this.dmQueue.getJob(jobId);
    if (existing && await existing.getState() === 'active') {
      throw new ConflictException('This webhook event is still being processed. Try again after the worker finishes.');
    }

    const redrivenAt = new Date();
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.webhookEvent.updateMany({
          where: {
            id, deadLetterAt: event.deadLetterAt, processedAt: null,
            attempts: event.attempts, payloadPurgedAt: null,
          },
          data: {
            attempts: 0,
            deadLetterAt: null,
            nextAttemptAt: redrivenAt,
            lastError: 'Manually redriven by an administrator.',
            redriveCount: { increment: 1 },
            lastRedrivenAt: redrivenAt,
            lastRedrivenBy: adminUserId,
          },
        });
        if (claimed.count !== 1) throw new ConflictException('This event changed while redrive was being requested. Refresh and try again.');
        await tx.adminAuditEvent.create({
          data: {
            actorId: adminUserId, action: 'WEBHOOK_DEAD_LETTER_REDRIVEN', targetType: 'WEBHOOK_EVENT', targetId: id,
              reason, requestId: randomUUID(),
            before: { attempts: event.attempts, redriveCount: event.redriveCount },
            after: { attempts: 0, redriveCount: event.redriveCount + 1 },
          },
        });
    });

    try {
      const queued = await this.enqueueEvents([{ id: event.id, eventId: event.eventId, payload: event.payload }]);
      return { status: queued ? 'queued' : 'pending', redriveCount: event.redriveCount + 1 };
    } catch (error) {
      // The durable row is now pending; scheduled reconciliation can recover
      // it after Redis returns without another operator action.
      this.log.warn(`Webhook redrive queue unavailable (${safeErrorLabel(error)})`);
      return { status: 'pending_recovery', redriveCount: event.redriveCount + 1 };
    }
  }

  async purgeExpiredDeadLetterPayloads(retentionDays = 30): Promise<number> {
    const days = Math.min(Math.max(Math.floor(retentionDays), 1), 365);
    const purgedAt = new Date();
    const cutoff = new Date(purgedAt.getTime() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.webhookEvent.updateMany({
      where: { deadLetterAt: { lte: cutoff }, processedAt: null, payloadPurgedAt: null },
      data: {
        payload: Prisma.DbNull,
        payloadPurgedAt: purgedAt,
        lastError: 'Webhook payload purged under retention policy.',
      },
    });
    return result.count;
  }

  private async enqueueEvents(events: Array<{ id: string; eventId: string; payload: unknown }>): Promise<number> {
    const candidates: Array<{ name: string; data: { webhookEventId: string }; opts: { jobId: string; attempts: number } }> = [];
    await Promise.all(events.map(async (event) => {
      const jobId = `wh-${createHash('sha256').update(event.eventId).digest('hex')}`;
      const existing = await this.dmQueue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (['active', 'waiting', 'delayed', 'waiting-children', 'paused'].includes(state)) return;
        try {
          await existing.remove(); // Revive failed/completed-but-unprocessed jobs.
        } catch {
          // Another retry may have removed the same terminal job concurrently.
          const current = await this.dmQueue.getJob(jobId);
          if (current) {
            const currentState = await current.getState();
            if (['active', 'waiting', 'delayed', 'waiting-children', 'paused'].includes(currentState)) return;
            await current.remove();
          }
        }
      }
      // Postgres owns webhook retry timing and attempt counts. A single BullMQ
      // attempt prevents its global fast retry policy from bypassing the
      // durable nextAttemptAt backoff stored on the event receipt.
      candidates.push({ name: 'process-webhook-event', data: { webhookEventId: event.id }, opts: { jobId, attempts: 1 } });
    }));
    if (!candidates.length) return 0;
    await this.dmQueue.addBulk(candidates);
    return candidates.length;
  }

  async processEvent(webhookEventId: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
    if (!event || event.processedAt || event.deadLetterAt || !event.payload) return;
    let ownerUserId: string | null = null;
    if (!event.igAccountId) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), payload: Prisma.DbNull, lastError: null },
      });
      return;
    }
    if (event.igUserId) {
      const account = await this.prisma.igAccount.findUnique({
        where: { id: event.igAccountId },
        select: { isActive: true, userId: true, user: { select: { deletionRequestedAt: true, suspendedAt: true } } },
      });
      if (!account || !account.isActive || account.user.deletionRequestedAt || account.user.suspendedAt) {
        await this.prisma.webhookEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date(), payload: Prisma.DbNull, lastError: null },
        });
        return;
      }
      ownerUserId = account.userId;
    }
    const attempt = await this.prisma.webhookEvent.update({
      where: { id: event.id },
      data: { attempts: { increment: 1 }, nextAttemptAt: null },
      select: { attempts: true },
    });

    try {
      await this.handle(event.payload);
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), payload: Prisma.DbNull, lastError: null },
      });
      if (ownerUserId) {
        try {
          await this.dashboardEvents.publish(ownerUserId, 'instagram');
        } catch (error) {
          this.log.warn(`Dashboard Instagram update unavailable (${safeErrorLabel(error)})`);
        }
      }
    } catch (error: any) {
      const deadLettered = attempt.attempts >= 8;
      const delayMs = Math.min(5 * 60_000, 10_000 * 2 ** Math.max(0, attempt.attempts - 1));
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          lastError: `Webhook processing failed (${safeErrorLabel(error)})`,
          nextAttemptAt: deadLettered ? null : new Date(Date.now() + delayMs),
          deadLetterAt: deadLettered ? new Date() : null,
        },
      });
      if (deadLettered) {
        const eventType = event.eventId.startsWith('comment:') ? 'comment' : 'message';
        this.log.error(`Instagram ${eventType} webhook moved to dead letter after ${attempt.attempts} attempts`);
      }
      throw error;
    }
  }

  async handle(payload: any): Promise<void> {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (change.field === 'comments') await this.onComment(entry, change.value);
      }
      for (const msg of entry.messaging ?? []) {
        await this.onMessage(entry, msg);
      }
    }
  }

  private async onComment(entry: any, value: any) {
    const igUserId = typeof entry?.id === 'string' ? entry.id : '';
    const normalized = normalizeCommentValue(value);
    if (!normalized) return;
    const commentId = normalized.id;
    const text: string = normalized.text ?? '';
    const fromId = normalized.from?.id ? String(normalized.from.id) : '';
    const fromUser = normalized.from?.username as string | undefined;
    let mediaId = String(normalized.media?.id ?? '');
    let commentCreatedAt: string | undefined;
    if (!fromId || !commentId) return;

    const account = await this.prisma.igAccount.findUnique({ where: { igUserId } });
    if (!account?.isActive) return;
    const user = await this.prisma.user.findUnique({
      where: { id: account.userId },
      select: { plan: true, planExpiresAt: true, trialEndsAt: true, deletionRequestedAt: true, suspendedAt: true },
    });
    if (!user || user.deletionRequestedAt || user.suspendedAt) return;
    const plan = planFor(user);
    const orderedActiveAccountIds = (await this.prisma.igAccount.findMany({
      where: { userId: account.userId, isActive: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    })).map((row) => row.id);
    const accountRestriction = accountPlanRestriction(plan, orderedActiveAccountIds, account.id);

    // Don't reply to the creator's own comments.
    if (fromId === igUserId) return;

    const automations = await this.prisma.automation.findMany({
      where: {
        igAccountId: account.id,
        status: 'LIVE',
        triggerType: { in: ['POST_COMMENT', 'ANY_POST'] },
      },
    });
    // Meta may omit a carousel's parent album ID from the webhook. Resolve it
    // before choosing between specific-media and account-wide rules. If the
    // ID remains unknown, retry the durable webhook instead of allowing a
    // fallback rule to send a potentially incorrect reply.
    if (!mediaId && automations.some((automation) => !!automation.mediaId)) {
      const token = this.encryption.decrypt(account.accessTokenEnc);
      const metadata = await this.instagram.getCommentMetadata(token, commentId, account.loginMode);
      commentCreatedAt = metadata.createdAt;
      mediaId = metadata.mediaId ?? '';
      if (!mediaId) throw new ServiceUnavailableException('Instagram comment media ID is unavailable; webhook processing will retry.');
    }
    // A media-specific rule must win over the global fallback if both match.
    // Tie-break by creation time and id so the selected automation is stable.
    automations.sort((left, right) => {
      const leftSpecific = left.mediaId === mediaId ? 1 : 0;
      const rightSpecific = right.mediaId === mediaId ? 1 : 0;
      return rightSpecific - leftSpecific || createdAutomationOrder(left, right);
    });

    for (const a of automations) {
      if (a.mediaId && a.mediaId !== mediaId) continue;
      const res = matchComment({ text, matchMode: a.matchMode as MatchMode, keywords: a.keywords });
      if (!res.matched) continue; // AI_INTENT deferral handled in a later pass
      const triggerEventId = `comment:${igUserId}:${commentId}`;
      const restriction = accountRestriction ?? automationRestriction(plan, a, { includeFollowUps: false });
      if (restriction) {
        await this.recordSkipped(a.id, account.id, triggerEventId, null, restriction);
        break;
      }
      // Meta measures private-reply eligibility from comment creation, not
      // from entry.time (the webhook notification timestamp).
      if (!commentCreatedAt) {
        const token = this.encryption.decrypt(account.accessTokenEnc);
        commentCreatedAt = (await this.instagram.getCommentMetadata(token, commentId, account.loginMode)).createdAt;
      }
      if (!(await this.quota.consume(account.userId, a.id, a.dailyLimit, triggerEventId))) {
        await this.recordSkipped(a.id, account.id, triggerEventId, null, 'Your plan DM quota or this automation daily limit has been reached.');
        this.log.warn('DM quota reached; comment skipped');
        break;
      }
      await this.enqueue({
        automationId: a.id, igAccountId: account.id, triggerType: a.triggerType,
        commentId, recipientIgsid: fromId, recipientUsername: fromUser,
        commentCreatedAt,
        text: this.firstText(a.dmBlocks), matchedKeyword: res.keyword,
        triggerEventId,
      });
      break; // one automation per comment
    }
  }

  private async onMessage(entry: any, msg: any) {
    const igUserId = typeof entry?.id === 'string' ? entry.id : '';
    const senderId = msg.sender?.id ? String(msg.sender.id) : '';
    const text: string = msg.message?.text ?? '';
    const mid = msg.message?.mid ? String(msg.message.mid) : '';
    if (!senderId || senderId === igUserId || !mid) return;
    if (msg.message?.is_echo) return;
    const providerTimestamp = typeof msg.timestamp === 'number' || (typeof msg.timestamp === 'string' && /^\d+$/.test(msg.timestamp))
      ? Number(msg.timestamp)
      : Number.NaN;
    if (!Number.isFinite(providerTimestamp) || providerTimestamp <= 0 || providerTimestamp > Date.now() + 5 * 60_000) {
      // Never replace a missing provider timestamp with the current time: that
      // would incorrectly create a fresh Meta messaging window for an old or
      // malformed event.
      this.log.warn('Skipping inbound Instagram message with an invalid provider timestamp');
      return;
    }
    const replyAt = new Date(providerTimestamp);

    const account = await this.prisma.igAccount.findUnique({ where: { igUserId } });
    if (!account?.isActive) return;
    const user = await this.prisma.user.findUnique({
      where: { id: account.userId },
      select: { plan: true, planExpiresAt: true, trialEndsAt: true, deletionRequestedAt: true, suspendedAt: true },
    });
    if (!user || user.deletionRequestedAt || user.suspendedAt) return;
    const plan = planFor(user);
    const orderedActiveAccountIds = (await this.prisma.igAccount.findMany({
      where: { userId: account.userId, isActive: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    })).map((row) => row.id);
    const accountRestriction = accountPlanRestriction(plan, orderedActiveAccountIds, account.id);

    // Preserve the provider event time. Duplicate or out-of-order webhooks
    // must not move the conversation window backwards.
    const contact = await this.prisma.contact.upsert({
      where: { igAccountId_igScopedId: { igAccountId: account.id, igScopedId: senderId } },
      create: { igAccountId: account.id, igScopedId: senderId, lastReplyAt: replyAt, lastInteraction: new Date() },
      update: { lastInteraction: new Date() },
    });
    await this.prisma.contact.updateMany({
      where: { id: contact.id, OR: [{ lastReplyAt: null }, { lastReplyAt: { lt: replyAt } }] },
      data: { lastReplyAt: replyAt },
    });
    await this.scheduleCommentFollowUps(account, contact, replyAt);

    // A story reply arrives as a message with reply_to.story; a plain DM does not.
    const kind = msg.message?.reply_to?.story ? 'STORY_REPLY' : 'DM';
    const adReferral = msg.message?.referral;
    const adId = adReferral?.ad_id;
    const hasMetaAdId = (typeof adId === 'number' && Number.isSafeInteger(adId) && adId > 0)
      || (typeof adId === 'string' && /^\d+$/.test(adId));
    // Meta documents this signed messages-webhook marker for Click-to-Direct
    // ads. Require the complete marker and only extend ordinary DM triggers;
    // story replies and generic referrals stay on the 24-hour rule.
    const clickToDirectAd = kind === 'DM' && adReferral?.source === 'ADS'
      && adReferral?.type === 'OPEN_THREAD' && hasMetaAdId;

    const automations = await this.prisma.automation.findMany({
      where: { igAccountId: account.id, status: 'LIVE', triggerType: kind },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    automations.sort(createdAutomationOrder);
    for (const a of automations) {
      const res = matchComment({ text, matchMode: a.matchMode as MatchMode, keywords: a.keywords });
      if (!res.matched) continue;
      const triggerEventId = `message:${igUserId}:${mid}`;
      const restriction = accountRestriction ?? automationRestriction(plan, a, { includeFollowUps: false });
      if (restriction) {
        await this.recordSkipped(a.id, account.id, triggerEventId, contact.id, restriction);
        break;
      }
      if (!(await this.quota.consume(account.userId, a.id, a.dailyLimit, triggerEventId))) {
        await this.recordSkipped(a.id, account.id, triggerEventId, contact.id, 'Your plan DM quota or this automation daily limit has been reached.');
        this.log.warn('DM quota reached; message skipped');
        break;
      }
      await this.enqueue({
        automationId: a.id, igAccountId: account.id, triggerType: kind,
        recipientIgsid: senderId, text: this.firstText(a.dmBlocks),
        matchedKeyword: res.keyword, triggerEventId, replyReceivedAt: replyAt.toISOString(),
        ...(clickToDirectAd ? { messageWindow: 'CLICK_TO_DIRECT_AD' as const } : {}),
      });
      break;
    }
  }

  private async scheduleCommentFollowUps(
    account: { id: string; igUserId: string },
    contact: { id: string; igScopedId: string; username?: string | null },
    replyAt: Date,
  ) {
    const primary = await this.prisma.run.findFirst({
      where: {
        igAccountId: account.id,
        contactId: contact.id,
        status: 'SENT',
        sentAt: { lte: replyAt },
        triggerEventId: { startsWith: `comment:${account.igUserId}:` },
        automation: { is: { status: 'LIVE', triggerType: { in: ['POST_COMMENT', 'ANY_POST'] } } },
      },
      orderBy: { sentAt: 'desc' },
      include: {
        automation: { include: { followUps: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!primary?.sentAt || primary.automation.status !== 'LIVE' || !primary.automation.followUps.length) return;

    const separator = primary.triggerEventId.lastIndexOf(':');
    const commentId = separator >= 0 ? primary.triggerEventId.slice(separator + 1) : '';
    if (!commentId) return;

    for (const followUp of primary.automation.followUps) {
      const eventId = `${primary.triggerEventId}:fu:${followUp.id}`;
      const priorRun = await this.prisma.run.findUnique({ where: { triggerEventId: eventId } });
      const resumableSkip = priorRun?.status === 'SKIPPED' && priorRun.error === COMMENT_FOLLOWUP_REPLY_REQUIRED;
      if (priorRun && ['SENT', 'PENDING', 'FAILED', 'UNKNOWN'].includes(priorRun.status)) continue;
      if (priorRun?.status === 'SKIPPED' && !resumableSkip) continue;

      const queueJobId = dmQueueJobId(eventId);
      const queued = await this.dmQueue.getJob(queueJobId) ?? await this.dmQueue.getJob(eventId);
      if (queued) {
        const state = await queued.getState();
        if (state === 'active') continue;
        if (!resumableSkip && ['waiting', 'delayed', 'paused', 'waiting-children'].includes(state)) continue;
        await queued.remove();
      }

      const delayMs = Math.max(0, Math.min(
        replyAt.getTime() + Math.max(0, followUp.delayMinutes) * 60_000 - Date.now(),
        24 * 60 * 60_000 - 60_000,
      ));
      const job: DmJob = {
        automationId: primary.automationId,
        igAccountId: account.id,
        triggerType: primary.automation.triggerType,
        commentId,
        recipientIgsid: contact.igScopedId,
        recipientUsername: contact.username ?? undefined,
        text: this.firstText(primary.automation.dmBlocks),
        triggerEventId: primary.triggerEventId,
        followUpId: followUp.id,
        followUpOrder: followUp.order,
        primarySentAt: primary.sentAt.toISOString(),
        replyReceivedAt: replyAt.toISOString(),
      };
      await this.dmQueue.add('send', job, { jobId: queueJobId, delay: delayMs });
    }
  }

  private firstText(dmBlocks: unknown): string {
    const blocks = Array.isArray(dmBlocks) ? dmBlocks : [];
    const t = (blocks as any[]).find(b => b?.type === 'text');
    return t?.text ?? 'Thanks for reaching out!';
  }

  private async recordSkipped(automationId: string, igAccountId: string, triggerEventId: string, contactId: string | null, reason: string) {
    await this.prisma.run.upsert({
      where: { triggerEventId },
      create: { automationId, igAccountId, triggerEventId, contactId, status: 'SKIPPED', error: reason },
      update: { contactId, status: 'SKIPPED', error: reason },
    });
  }

  private async enqueue(job: DmJob) {
    // During rollout, don't create a second job when an older worker already
    // queued this event under its pre-hash ID.
    if (await this.dmQueue.getJob(job.triggerEventId)) return;
    await this.dmQueue.add('send', job, { jobId: dmQueueJobId(job.triggerEventId) });
  }

}
