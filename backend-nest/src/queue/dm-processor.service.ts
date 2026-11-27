import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DelayedError, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService, DmButton } from '../meta/meta.service';
import type { InstagramLoginMode } from '../instagram/instagram.service';
import { EncryptionService } from '../common/encryption.service';
import { CLICK_TO_DIRECT_AD_MESSAGE_WINDOW_MS, COMMENT_FOLLOWUP_REPLY_REQUIRED, commentPrivateReplyWindowState, DmJob, dmQueueJobId, messageWindowState, MessageWindowType, runEventId, STANDARD_MESSAGE_WINDOW_MS } from './queue.constants';
import { DM_QUEUE_TOKEN } from './queue.constants';
import { extractButtons, applyTracking } from '../automations/dm-blocks';
import { personalize } from '../automations/personalize';
import {
  getRandomFollowPrompt,
  getFollowButtons,
  getRandomEmailPrompt,
  normalizeLanguage,
} from '../automations/automation-templates';
import { accountPlanRestriction, planFor } from '../common/plan.util';
import { automationRestriction } from '../common/automation-entitlement';
import { DmQuotaService } from '../common/dm-quota.service';
import { reserveCommentPrivateReply } from './instagram-rate-limiter';
import { DashboardEventsService } from './dashboard-events.service';
import { safeErrorLabel } from '../common/safe-error-label';

const WINDOW_MS = STANDARD_MESSAGE_WINDOW_MS;

// Processes a DM job — primary send or a scheduled follow-up.
@Injectable()
export class DmProcessorService {
  private readonly log = new Logger(DmProcessorService.name);
  constructor(
    private prisma: PrismaService,
    private meta: MetaService,
    private enc: EncryptionService,
    private config: ConfigService,
    private quota: DmQuotaService,
    @Inject(DM_QUEUE_TOKEN) private dmQueue: Queue,
    private dashboardEvents: DashboardEventsService,
  ) {}

  async process(job: DmJob, queueJob?: Job<DmJob>): Promise<void> {
    if (job.followUpId) return this.processFollowUp(job, queueJob);
    return this.processPrimary(job, queueJob);
  }

  async markDeliveryUnknown(job: DmJob, reason: string): Promise<void> {
    if (!job.triggerEventId) return;
    const updated = await this.prisma.run.updateMany({
      where: { triggerEventId: runEventId(job), status: 'PENDING' },
      data: {
        status: 'UNKNOWN',
        error: `Delivery could not be confirmed after worker retries. Check Instagram before retrying. ${reason}`.slice(0, 500),
      },
    });
    if (updated?.count > 0) await this.publishDeliveryUpdate(job);
  }

  async markStalePendingRunsUnknown(): Promise<number> {
    // A run is created only after a worker begins processing it. Messages
    // normally finish in seconds; 15 minutes leaves room for transient API
    // issues while recovering runs stranded by a worker crash or lost queue job.
    const cutoff = new Date(Date.now() - 15 * 60_000);
    const result = await this.prisma.run.updateMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      data: {
        status: 'UNKNOWN',
        error: 'Worker processing did not finish. Delivery could not be confirmed; check Instagram before retrying.',
      },
    });
    return result.count;
  }

  // ---------- primary DM ----------
  private async processPrimary(job: DmJob, queueJob?: Job<DmJob>): Promise<void> {
    const existing = await this.prisma.run.findUnique({ where: { triggerEventId: job.triggerEventId } });
    if (existing?.status === 'SENT') {
      // Repair the rare crash window where the run was marked sent but its
      // quota reservation was not yet finalized.
      await this.quota.settle(job.triggerEventId, true);
      // The Meta send may have succeeded before follow-up enqueue failed. The
      // deterministic follow-up job IDs make this safe to reconcile on retry.
      const automation = await this.prisma.automation.findUnique({
        where: { id: job.automationId },
        include: {
          followUps: { orderBy: { order: 'asc' }, select: { id: true, order: true, delayMinutes: true } },
          igAccount: { include: { user: { select: { id: true, plan: true, planExpiresAt: true, trialEndsAt: true } } } },
        },
      });
      if (existing.sentAt && automation) {
        const activeAccounts = await this.activeAccountIds(automation.igAccount.user.id);
        const restriction = accountPlanRestriction(planFor(automation.igAccount.user), activeAccounts, automation.igAccount.id)
          ?? automationRestriction(planFor(automation.igAccount.user), {
          ...automation,
          followUpCount: automation.followUps.length,
        });
        if (restriction) {
          await this.prisma.run.update({ where: { id: existing.id }, data: { error: `The primary DM was sent. ${restriction} No follow-ups were scheduled.` } });
        } else if (!job.commentId) {
          await this.scheduleFollowUps(automation.followUps, { ...job, primarySentAt: existing.sentAt.toISOString() });
        }
      }
      return;
    }
    if (existing && ['SKIPPED', 'FAILED', 'UNKNOWN'].includes(existing.status)) {
      // Never replay a terminal event from a duplicate webhook delivery. In
      // particular UNKNOWN may already have reached Meta and must not be sent twice.
      if (existing.status === 'SKIPPED' || existing.status === 'FAILED') {
        await this.quota.settle(job.triggerEventId, false);
      }
      return;
    }

    const automation = await this.prisma.automation.findUnique({
      where: { id: job.automationId },
      include: {
        igAccount: { include: { user: { select: { id: true, plan: true, planExpiresAt: true, trialEndsAt: true } } } },
        trackedLinks: true,
        followUps: { orderBy: { order: 'asc' } },
      },
    });
    if (!automation) return;
    const commentWindow = job.commentId && !job.followUpId ? commentPrivateReplyWindowState(job.commentCreatedAt) : 'ELIGIBLE';
    if (commentWindow !== 'ELIGIBLE') {
      const reason = commentWindow === 'EXPIRED'
        ? 'This comment was created more than seven days ago; Instagram private replies are no longer eligible.'
        : 'The comment creation time could not be verified; no private reply was sent to protect Instagram eligibility.';
      if (existing?.status === 'PENDING') {
        // A previous attempt may have reached Meta before its response was
        // lost. Preserve that uncertainty instead of converting it to a
        // definite no-send or retrying an expired private reply.
        const updated = await this.prisma.run.updateMany({
          where: { triggerEventId: runEventId(job), status: 'PENDING' },
          data: { status: 'UNKNOWN', error: reason },
        });
        if (updated?.count > 0) await this.publishDeliveryUpdate(job);
      } else {
        await this.recordRun(job, null, 'SKIPPED', reason);
      }
      return;
    }
    if (job.triggerType === 'DM' || job.triggerType === 'STORY_REPLY' || job.triggerType === 'STORY_MENTION') {
      // Meta's standard messaging window begins at the viewer's inbound
      // message. Preserve compatibility with already-queued jobs by falling
      // back to BullMQ's immutable enqueue timestamp during rollout.
      const messageAt = job.replyReceivedAt ?? (Number.isFinite(queueJob?.timestamp)
        ? new Date(queueJob!.timestamp).toISOString()
        : undefined);
      const messageWindow: MessageWindowType = job.triggerType === 'DM' && job.messageWindow === 'CLICK_TO_DIRECT_AD'
        ? 'CLICK_TO_DIRECT_AD'
        : 'STANDARD';
      const windowState = messageWindowState(messageAt, messageWindow);
      if (windowState !== 'ELIGIBLE') {
        const reason = windowState === 'EXPIRED'
          ? `The ${messageWindow === 'CLICK_TO_DIRECT_AD' ? '7-day Click-to-Direct ad' : '24-hour'} Instagram messaging window for this inbound message has expired; no reply was sent.`
          : 'The original message time could not be verified; the reply was skipped to protect messaging eligibility.';
        if (existing?.status === 'PENDING') {
          // An earlier attempt may have reached Meta before a timeout. Keep
          // the result ambiguous instead of treating it as a definite no-send.
          const updated = await this.prisma.run.updateMany({
            where: { triggerEventId: runEventId(job), status: 'PENDING' },
            data: { status: 'UNKNOWN', error: reason },
          });
          if (updated?.count > 0) await this.publishDeliveryUpdate(job);
        } else {
          await this.recordRun(job, null, 'SKIPPED', reason);
        }
        return;
      }
    }
    const plan = planFor(automation.igAccount.user);
    const activeAccounts = await this.activeAccountIds(automation.igAccount.user.id);
    const restriction = accountPlanRestriction(plan, activeAccounts, automation.igAccount.id)
      ?? automationRestriction(plan, automation, { includeFollowUps: false });
    if (restriction) {
      await this.recordRun(job, null, 'SKIPPED', restriction);
      return;
    }
    if (automation.status !== 'LIVE' || !automation.igAccount.isActive) {
      await this.recordRun(job, null, 'SKIPPED', automation.status !== 'LIVE' ? 'automation is not live' : 'Instagram account is disconnected');
      return;
    }
    await this.recordRun(job, null, 'PENDING');

    const token = this.enc.decrypt(automation.igAccount.accessTokenEnc);
    const igUserId = automation.igAccount.igUserId;
    const loginMode = automation.igAccount.loginMode;

    const contact = await this.prisma.contact.upsert({
      where: { igAccountId_igScopedId: { igAccountId: job.igAccountId, igScopedId: job.recipientIgsid } },
      create: { igAccountId: job.igAccountId, igScopedId: job.recipientIgsid, username: job.recipientUsername, lastInteraction: new Date() },
      update: { lastInteraction: new Date(), username: job.recipientUsername ?? undefined },
    });

    // Persist a visible run before calling Meta so in-flight and interrupted
    // deliveries do not disappear from the customer log.
    await this.recordRun(job, contact.id, 'PENDING');
    let publicReplyFailure = existing?.publicReplyError
      ? 'The public comment reply failed; the direct message was still sent.'
      : undefined;

    const isConversationalGateStep =
      job.triggerEventId.startsWith('follow-reminder:') ||
      job.triggerEventId.startsWith('follow-verified-email-prompt:') ||
      job.triggerEventId.startsWith('follow-verified-delivered:') ||
      job.triggerEventId.startsWith('email-retry-prompt:') ||
      job.triggerEventId.startsWith('email-collected-delivered:') ||
      job.triggerEventId.startsWith('email-skipped-delivered:');

    if (!isConversationalGateStep && automation.askToFollow && !contact.follows) {
      const { isFollower } = await this.meta.getFollowerInfo(igUserId, token, job.recipientIgsid, loginMode);
      await this.prisma.contact.update({ where: { id: contact.id }, data: { follows: isFollower } });
      if (!isFollower) {
        const accountUsername = automation.igAccount.username;
        const autoLang = normalizeLanguage(automation.language);
        const promptText = getRandomFollowPrompt(autoLang, accountUsername, job.recipientUsername || contact.name);
        const followButtons: DmButton[] = getFollowButtons(autoLang, accountUsername);

        const existingTags = contact.tags || [];
        const followTag = `pending_follow:${automation.id}`;
        if (!existingTags.includes(followTag)) {
          await this.prisma.contact.update({
            where: { id: contact.id },
            data: { tags: [...existingTags, followTag] },
          });
        }

        const promptResult = job.commentId
          ? await this.meta.sendCommentDm(igUserId, token, job.commentId, promptText, followButtons, loginMode)
          : await this.meta.sendDirectMessage(igUserId, token, job.recipientIgsid, promptText, followButtons, loginMode);

        if (!promptResult.ok) {
          if (promptResult.retryable) throw new Error(`Retryable Meta error: ${promptResult.error}`);
          await this.recordRun(job, contact.id, 'FAILED', promptResult.error);
          return;
        }

        // Auto-Like user's comment immediately on comment trigger, even if follow gate is active
        await this.tryAutoLikeComment(automation, igUserId, token, job.commentId, loginMode);

        await this.recordRun(job, contact.id, 'SENT', 'Follow-first verification prompt sent to user.');
        return;
      }
    }

    if (!isConversationalGateStep && automation.collectEmail && !contact.email) {
      const autoLang = normalizeLanguage(automation.language);
      const emailPromptText = getRandomEmailPrompt(autoLang, job.recipientUsername || contact.name);

      const existingTags = contact.tags || [];
      const emailTag = `pending_email:${automation.id}`;
      if (!existingTags.includes(emailTag)) {
        await this.prisma.contact.update({
          where: { id: contact.id },
          data: { tags: [...existingTags, emailTag] },
        });
      }

      const emailPromptResult = job.commentId
        ? await this.meta.sendCommentDm(igUserId, token, job.commentId, emailPromptText, [], loginMode)
        : await this.meta.sendDirectMessage(igUserId, token, job.recipientIgsid, emailPromptText, [], loginMode);

      if (!emailPromptResult.ok) {
        if (emailPromptResult.retryable) throw new Error(`Retryable Meta error: ${emailPromptResult.error}`);
        await this.recordRun(job, contact.id, 'FAILED', emailPromptResult.error);
        return;
      }

      // Auto-Like user's comment immediately on comment trigger, even if email capture is active
      await this.tryAutoLikeComment(automation, igUserId, token, job.commentId, loginMode);

      await this.recordRun(job, contact.id, 'SENT', 'Voluntary email collection prompt sent.');
      return;
    }

    if (!(await this.accountMaySend(job.igAccountId))) {
      await this.recordRun(job, contact.id, 'SKIPPED', 'This Instagram account is disconnected or being deleted.');
      return;
    }

    if (job.commentId) {
      if (!queueJob) throw new Error('Cannot reserve a comment reply without its BullMQ job.');
      await reserveCommentPrivateReply(this.dmQueue, queueJob, queueJob.token);
    }

    let ticketNumber: number | null = null;
    if (automation.isGiveaway || (job.text && (job.text.includes('{{ticket_number}}') || job.text.includes('{{ticket}}')))) {
      ticketNumber = await this.getOrCreateGiveawayTicket(
        automation.id,
        contact.id,
        job.recipientUsername || contact.username,
        job.recipientIgsid,
      );
    }

    const text = personalize(job.text, { username: job.recipientUsername, name: contact.name, ticketNumber });
    const attributionSecret = automation.trackClicks && automation.trackedLinks.length > 0
      ? this.config.getOrThrow<string>('ENCRYPTION_KEY')
      : undefined;
    const isEmailPromptJob =
      job.triggerEventId?.startsWith('follow-verified-email-prompt:') ||
      job.triggerEventId?.startsWith('email-retry-prompt:');
    const buttons = isEmailPromptJob
      ? []
      : job.customButtons !== undefined
      ? job.customButtons
      : applyTracking(
          extractButtons(automation.dmBlocks), automation.trackedLinks, automation.trackClicks,
          this.publicUrl(), job.recipientIgsid, attributionSecret,
        );

    const currentStatus = await this.currentAutomationStatus(job.automationId);
    if (currentStatus !== 'LIVE') {
      if (currentStatus) await this.recordRun(job, contact.id, 'SKIPPED', 'Automation is not live.');
      return;
    }
    if (!(await this.accountMaySend(job.igAccountId))) {
      await this.recordRun(job, contact.id, 'SKIPPED', 'This Instagram account is disconnected or being deleted.');
      return;
    }

    // 1. Send the Private Reply / DM first to ensure delivery before any public notification.
    const result = job.commentId
      ? await this.meta.sendCommentDm(igUserId, token, job.commentId, text, buttons, loginMode)
      : await this.meta.sendDirectMessage(igUserId, token, job.recipientIgsid, text, buttons, loginMode);

    if (!result.ok) {
      if (result.retryable) throw new Error(`Retryable Meta error: ${result.error}`);
      await this.recordRun(job, contact.id, 'FAILED', result.error);
      return;
    }

    // 2. Auto-Like the user's comment if configured (Algorithm & Dopamine Booster).
    await this.tryAutoLikeComment(automation, igUserId, token, job.commentId, loginMode);

    // 3. Only after Private Reply succeeds, post rotated public comment reply if configured.
    if (automation.replyToComment && job.commentId && automation.publicReplies.length && !existing?.publicReplyAttemptedAt) {
      const currentPostStatus = await this.currentAutomationStatus(job.automationId);
      if (currentPostStatus === 'LIVE' && (await this.accountMaySend(job.igAccountId))) {
        const reply = await this.getNextPublicReply(job.automationId, automation.publicReplies);
        const replyResult = await this.meta.replyToComment(token, job.commentId, reply, loginMode);
        if (!replyResult.ok) {
          publicReplyFailure = 'The public comment reply failed; the direct message was successfully sent.';
        }
        await this.prisma.run.update({
          where: { triggerEventId: runEventId(job) },
          data: {
            publicReplyAttemptedAt: new Date(),
            publicReplyError: replyResult.ok ? null : replyResult.error,
          },
        });
      }
    }

    const followUpRestriction = automationRestriction(plan, { followUpCount: automation.followUps.length });
    await this.recordRun(
      job,
      contact.id,
      'SENT',
      followUpRestriction && automation.followUps.length
        ? `DM sent. ${followUpRestriction} No follow-ups were scheduled.`
        : publicReplyFailure,
    );
    await this.prisma.contact.update({ where: { id: contact.id }, data: { dmsSent: { increment: 1 } } });

    // Schedule follow-ups within the message's actual Meta eligibility window.
    if (!followUpRestriction && !job.commentId) await this.scheduleFollowUps(automation.followUps, job);
  }

  private async scheduleFollowUps(followUps: { id: string; order: number; delayMinutes: number }[], job: DmJob) {
    const sentAt = job.primarySentAt ?? new Date().toISOString();
    const windowMs = job.messageWindow === 'CLICK_TO_DIRECT_AD' ? CLICK_TO_DIRECT_AD_MESSAGE_WINDOW_MS : WINDOW_MS;
    // Meta measures this window from the person's inbound message, not from
    // the time HeyLaunch sent its primary response.
    const windowStart = job.replyReceivedAt ? new Date(job.replyReceivedAt) : new Date(sentAt);
    const maxDelayMs = Math.max(0, windowMs - (Date.now() - windowStart.getTime()) - 60_000);
    for (const fu of followUps) {
      if ((await this.currentAutomationStatus(job.automationId)) !== 'LIVE') return;
      const delayMs = Math.min(Math.max(fu.delayMinutes, 0) * 60_000, maxDelayMs);
      const eventId = `${job.triggerEventId}:fu:${fu.id}`;
      if (await this.dmQueue.getJob(eventId)) continue; // legacy raw ID during rollout
      const queued = await this.dmQueue.add(
        'send',
        { ...job, followUpId: fu.id, followUpOrder: fu.order, primarySentAt: sentAt },
        { jobId: dmQueueJobId(eventId), delay: delayMs },
      );
      // Deletion can pause the automation between the first check and enqueue.
      // The delete path also waits for active jobs, so removing this job here
      // closes the small race without allowing an orphaned delayed delivery.
      if ((await this.currentAutomationStatus(job.automationId)) !== 'LIVE') {
        await queued.remove();
        return;
      }
    }
  }

  // ---------- follow-up DM ----------
  private async processFollowUp(job: DmJob, queueJob?: Job<DmJob>): Promise<void> {
    const eventId = runEventId(job);
    const existingRun = await this.prisma.run.findUnique({ where: { triggerEventId: eventId } });
    const canResumeAfterCommentReply = existingRun?.status === 'SKIPPED'
      && existingRun.error === COMMENT_FOLLOWUP_REPLY_REQUIRED;
    if (existingRun && ['SENT', 'SKIPPED', 'FAILED', 'UNKNOWN'].includes(existingRun.status) && !canResumeAfterCommentReply) {
      if (existingRun.status === 'SENT') await this.quota.settle(eventId, true);
      if (existingRun.status === 'SKIPPED' || existingRun.status === 'FAILED') await this.quota.settle(eventId, false);
      return;
    }

    const fu = await this.prisma.followUp.findUnique({
      where: { id: job.followUpId! },
      include: {
        automation: {
          include: {
            igAccount: { include: { user: { select: { id: true, plan: true, planExpiresAt: true, trialEndsAt: true } } } },
            trackedLinks: true,
          },
        },
      },
    });
    if (!fu) {
      const automation = await this.prisma.automation.findUnique({ where: { id: job.automationId }, select: { id: true } });
      if (!automation) return; // parent deletion cascaded the run; avoid retrying a foreign-key failure
      await this.recordRun(job, null, 'SKIPPED', 'This follow-up step was removed before it could run.');
      return;
    }
    if (fu.automation.status !== 'LIVE' || !fu.automation.igAccount.isActive) {
      await this.recordRun(job, null, 'SKIPPED', fu.automation.status !== 'LIVE' ? 'Automation is not live.' : 'Instagram account is disconnected.');
      return;
    }
    const activeAccounts = await this.activeAccountIds(fu.automation.igAccount.user.id);
    const followUpPlan = planFor(fu.automation.igAccount.user);
    const restriction = accountPlanRestriction(followUpPlan, activeAccounts, fu.automation.igAccount.id)
      ?? automationRestriction(followUpPlan, {
      ...fu.automation,
      followUpCount: 1,
      });
    if (restriction) {
      await this.recordRun(job, null, 'SKIPPED', restriction);
      return;
    }

    const contact = await this.prisma.contact.findUnique({
      where: { igAccountId_igScopedId: { igAccountId: job.igAccountId, igScopedId: job.recipientIgsid } },
    });
    if (!contact) {
      await this.recordRun(job, null, 'SKIPPED', 'The Instagram contact record is no longer available.');
      return;
    }

    const primarySentAt = job.primarySentAt ? new Date(job.primarySentAt) : null;
    const replyAt = job.replyReceivedAt ? new Date(job.replyReceivedAt) : contact.lastReplyAt ? new Date(contact.lastReplyAt) : null;
    if (job.commentId && (!primarySentAt || !replyAt || replyAt <= primarySentAt)) {
      await this.recordRun(job, contact.id, 'SKIPPED', COMMENT_FOLLOWUP_REPLY_REQUIRED);
      return;
    }

    // A comment private reply opens the follow-up window only after the
    // commenter responds. Use that response time, not the private-reply time.
    const latestReplyAt = contact.lastReplyAt && replyAt && contact.lastReplyAt > replyAt ? contact.lastReplyAt : replyAt;
    const windowStart = job.commentId
      ? latestReplyAt
      : job.replyReceivedAt ? new Date(job.replyReceivedAt) : primarySentAt;
    const windowMs = !job.commentId && job.messageWindow === 'CLICK_TO_DIRECT_AD'
      ? CLICK_TO_DIRECT_AD_MESSAGE_WINDOW_MS
      : WINDOW_MS;
    const since = windowStart ? Date.now() - windowStart.getTime() : 0;
    if (since >= windowMs) {
      await this.recordRun(job, contact.id, 'SKIPPED', `The ${windowMs === CLICK_TO_DIRECT_AD_MESSAGE_WINDOW_MS ? '7-day Click-to-Direct ad' : '24-hour'} messaging window has expired.`);
      return;
    }

    // Comment-triggered follow-ups only become eligible after the configured
    // delay from the commenter's latest reply. The webhook and queue updates
    // can race, so enforce the delay again at send time using the contact's
    // persisted monotonic lastReplyAt value.
    if (job.commentId && latestReplyAt) {
      const delayMs = Math.max(0, fu.delayMinutes) * 60_000;
      const eligibleAt = latestReplyAt.getTime() + delayMs;
      const safeWindowEnd = windowStart!.getTime() + windowMs - 60_000;
      if (eligibleAt > safeWindowEnd) {
        await this.recordRun(job, contact.id, 'SKIPPED', 'The configured follow-up delay leaves no safe time to send within Instagram’s messaging window.');
        return;
      }
      if (Date.now() < eligibleAt) {
        if (!queueJob?.token) throw new Error('Cannot defer an early comment follow-up without its BullMQ lock token.');
        await queueJob.updateData({ ...job, replyReceivedAt: latestReplyAt.toISOString() });
        await queueJob.moveToDelayed(eligibleAt, queueJob.token);
        throw new DelayedError();
      }
    }

    // Condition gate.
    const ok = await this.conditionHolds(fu.condition, fu.automationId, job, contact?.lastReplyAt ?? null);
    if (!ok) {
      await this.recordRun(job, contact.id, 'SKIPPED', `Follow-up condition ${fu.condition.toLowerCase().replaceAll('_', ' ')} was not met.`);
      return;
    }

    const reserved = await this.quota.consume(
      fu.automation.igAccount.user.id,
      fu.automationId,
      fu.automation.dailyLimit,
      eventId,
    );
    if (!reserved) {
      await this.recordRun(job, contact.id, 'SKIPPED', 'The plan DM quota or automation daily limit has been reached.');
      return;
    }

    await this.recordRun(job, contact.id, 'PENDING');

    const token = this.enc.decrypt(fu.automation.igAccount.accessTokenEnc);
    const igUserId = fu.automation.igAccount.igUserId;
    const loginMode = fu.automation.igAccount.loginMode;
    const blocks = fu.dmBlocks;
    const textBlock = (Array.isArray(blocks) ? blocks : []).find((b: any) => b?.type === 'text') as any;
    const text = personalize(textBlock?.text ?? 'Just following up!', { username: job.recipientUsername, name: contact?.name });
    const trackedLinks = fu.automation.trackedLinks ?? [];
    const attributionSecret = fu.automation.trackClicks && trackedLinks.length > 0
      ? this.config.getOrThrow<string>('ENCRYPTION_KEY')
      : undefined;
    const buttons = applyTracking(
      extractButtons(blocks), trackedLinks, fu.automation.trackClicks, this.publicUrl(), job.recipientIgsid, attributionSecret,
    );

    if ((await this.currentAutomationStatus(job.automationId)) !== 'LIVE') {
      await this.recordRun(job, contact.id, 'SKIPPED', 'Automation is not live.');
      return;
    }
    if (!(await this.accountMaySend(job.igAccountId))) {
      await this.recordRun(job, contact.id, 'SKIPPED', 'This Instagram account is disconnected or being deleted.');
      return;
    }

    // Follow-ups always go as a direct message (the comment thread is done).
    const result = await this.meta.sendDirectMessage(igUserId, token, job.recipientIgsid, text, buttons, loginMode);
    if (!result.ok) {
      if (result.retryable) throw new Error(`Retryable Meta error: ${result.error}`);
      await this.recordRun(job, contact.id, 'FAILED', result.error);
      return;
    }
    await this.recordRun(job, contact.id, 'SENT');
    await this.prisma.contact.update({ where: { id: contact.id }, data: { dmsSent: { increment: 1 } } });
  }

  private async conditionHolds(condition: string, automationId: string, job: DmJob, lastReplyAt: Date | null): Promise<boolean> {
    const after = job.primarySentAt ? new Date(job.primarySentAt) : new Date(0);
    switch (condition) {
      case 'DELAY':
        return true;
      case 'NO_REPLY':
        return !(lastReplyAt && lastReplyAt > after);
      case 'LINK_NOT_CLICKED': {
        const click = await this.prisma.click.findFirst({
          where: { contactIgsid: job.recipientIgsid, clickedAt: { gt: after }, trackedLink: { automationId } },
        });
        return !click;
      }
      // Need purchase/form events we don't emit yet — skip rather than spam.
      case 'BOUGHT':
      case 'NOT_BOUGHT':
      case 'FORM_NOT_SUBMITTED':
      default:
        return false;
    }
  }

  private async tryAutoLikeComment(
    automation: { autoLikeComment?: boolean },
    igUserId: string,
    token: string,
    commentId?: string,
    loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN',
  ): Promise<void> {
    if (automation.autoLikeComment && commentId) {
      try {
        await this.meta.likeComment(igUserId, token, commentId, loginMode);
      } catch (likeErr) {
        this.log.warn(`Auto-like failed for comment ${commentId}: ${safeErrorLabel(likeErr)}`);
      }
    }
  }

  private publicUrl() { return this.config.get<string>('PUBLIC_URL', 'http://localhost:4000'); }

  private async activeAccountIds(userId: string): Promise<string[]> {
    const accounts = await this.prisma.igAccount.findMany({
      where: { userId, isActive: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return accounts.map((account) => account.id);
  }

  private async accountMaySend(igAccountId: string): Promise<boolean> {
    const account = await this.prisma.igAccount.findUnique({
      where: { id: igAccountId },
      select: { isActive: true, user: { select: { deletionRequestedAt: true, suspendedAt: true } } },
    });
    return !!account?.isActive && !account.user.deletionRequestedAt && !account.user.suspendedAt;
  }

  private async currentAutomationStatus(automationId: string): Promise<'LIVE' | 'PAUSED' | 'DRAFT' | null> {
    const automation = await this.prisma.automation.findUnique({ where: { id: automationId }, select: { status: true } });
    return automation?.status ?? null;
  }

  private async recordRun(job: DmJob, contactId: string | null, status: 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED', error?: string) {
    const triggerEventId = runEventId(job);
    await this.prisma.run.upsert({
      where: { triggerEventId },
      create: { automationId: job.automationId, igAccountId: job.igAccountId, contactId, triggerEventId, followUpOrder: job.followUpOrder ?? null, status, error: error ?? null, sentAt: status === 'SENT' ? new Date() : null },
      update: { contactId, followUpOrder: job.followUpOrder ?? null, status, error: error ?? null, sentAt: status === 'SENT' ? new Date() : null },
    });
    if (status === 'SENT') await this.quota.settle(triggerEventId, true);
    else if (status === 'SKIPPED' || status === 'FAILED') await this.quota.settle(triggerEventId, false);
    if (status !== 'PENDING') await this.publishDeliveryUpdate(job);
  }

  private async publishDeliveryUpdate(job: DmJob): Promise<void> {
    try {
      const automation = await this.prisma.automation.findUnique({
        where: { id: job.automationId },
        select: { igAccount: { select: { userId: true } } },
      });
      const userId = automation?.igAccount?.userId;
      if (userId) await this.dashboardEvents.publish(userId, 'delivery');
    } catch (error) {
      // Never retry a provider delivery just because the optional UI
      // invalidation lookup failed after the run was durably recorded.
      this.log.warn(`Dashboard delivery update unavailable (${safeErrorLabel(error)})`);
    }
  }

  private async getOrCreateGiveawayTicket(
    automationId: string,
    contactId: string,
    igUsername?: string | null,
    igScopedId?: string,
  ): Promise<number> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const existing = await this.prisma.giveawayEntry.findUnique({
          where: { automationId_contactId: { automationId, contactId } },
          select: { ticketNumber: true },
        });
        if (existing) return existing.ticketNumber;

        return await this.prisma.$transaction(async (tx) => {
          const highest = await tx.giveawayEntry.findFirst({
            where: { automationId },
            orderBy: { ticketNumber: 'desc' },
            select: { ticketNumber: true },
          });
          const nextTicket = (highest?.ticketNumber ?? 1000) + 1;
          const created = await tx.giveawayEntry.create({
            data: {
              automationId,
              contactId,
              ticketNumber: nextTicket,
              igUsername: igUsername ?? null,
              igScopedId: igScopedId ?? '',
              status: 'ENTERED',
            },
            select: { ticketNumber: true },
          });
          return created.ticketNumber;
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 4) {
          continue;
        }
        this.log.warn(`Could not assign giveaway ticket for contact ${contactId}: ${safeErrorLabel(err)}`);
        break;
      }
    }
    const fallback = await this.prisma.giveawayEntry.findUnique({
      where: { automationId_contactId: { automationId, contactId } },
      select: { ticketNumber: true },
    });
    return fallback?.ticketNumber ?? 1001;
  }

  private async getNextPublicReply(automationId: string, replies: string[]): Promise<string> {
    if (!replies.length) return '';
    if (replies.length === 1) return replies[0];
    try {
      const redis = await this.dmQueue.client as unknown as { incr?: (k: string) => Promise<number> };
      if (redis && typeof redis.incr === 'function') {
        const count = await redis.incr(`rotation:public_reply:${automationId}`);
        return pickRotatedReply(replies, automationId, count);
      }
    } catch {
      // In-memory sequential fallback for tests and environments without Redis
    }
    return pickRotatedReply(replies, automationId);
  }
}

const inMemoryRotationCounters = new Map<string, number>();

export function pickRotatedReply(replies: string[], seed: string, redisCount?: number): string {
  if (!replies.length) return '';
  if (replies.length === 1) return replies[0];
  if (typeof redisCount === 'number' && Number.isFinite(redisCount)) {
    const index = Math.abs(Math.floor(redisCount) - 1) % replies.length;
    return replies[index];
  }
  const current = inMemoryRotationCounters.get(seed) ?? 0;
  inMemoryRotationCounters.set(seed, current + 1);
  return replies[current % replies.length];
}
