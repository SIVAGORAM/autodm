import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService, DmButton } from '../meta/meta.service';
import { EncryptionService } from '../common/encryption.service';
import { DmJob } from './queue.constants';
import { DM_QUEUE_TOKEN } from './queue.module';
import { extractButtons, applyTracking } from '../automations/dm-blocks';
import { personalize } from '../automations/personalize';

const WINDOW_MS = 24 * 60 * 60 * 1000; // Meta 24h messaging window

// Processes a DM job — primary send or a scheduled follow-up.
@Injectable()
export class DmProcessorService {
  private readonly log = new Logger(DmProcessorService.name);
  constructor(
    private prisma: PrismaService,
    private meta: MetaService,
    private enc: EncryptionService,
    private config: ConfigService,
    @Inject(DM_QUEUE_TOKEN) private dmQueue: Queue,
  ) {}

  async process(job: DmJob): Promise<void> {
    if (job.followUpId) return this.processFollowUp(job);
    return this.processPrimary(job);
  }

  // ---------- primary DM ----------
  private async processPrimary(job: DmJob): Promise<void> {
    const existing = await this.prisma.run.findUnique({ where: { triggerEventId: job.triggerEventId } });
    if (existing && existing.status === 'SENT') return;

    const automation = await this.prisma.automation.findUnique({
      where: { id: job.automationId },
      include: { igAccount: true, trackedLinks: true, followUps: { orderBy: { order: 'asc' } } },
    });
    if (!automation || automation.status !== 'LIVE') return;

    const token = this.enc.decrypt(automation.igAccount.accessTokenEnc);
    const igUserId = automation.igAccount.igUserId;

    const contact = await this.prisma.contact.upsert({
      where: { igAccountId_igScopedId: { igAccountId: job.igAccountId, igScopedId: job.recipientIgsid } },
      create: { igAccountId: job.igAccountId, igScopedId: job.recipientIgsid, username: job.recipientUsername, lastInteraction: new Date() },
      update: { lastInteraction: new Date(), username: job.recipientUsername ?? undefined },
    });

    if (automation.askToFollow) {
      const { isFollower } = await this.meta.getFollowerInfo(igUserId, token, job.recipientIgsid);
      await this.prisma.contact.update({ where: { id: contact.id }, data: { follows: isFollower } });
      if (!isFollower) { await this.recordRun(job, contact.id, 'SKIPPED', 'not a follower'); return; }
    }

    if (automation.replyToComment && job.commentId && automation.publicReplies.length) {
      const reply = automation.publicReplies[Math.floor(Math.random() * automation.publicReplies.length)];
      await this.meta.replyToComment(token, job.commentId, reply);
    }

    const text = personalize(job.text, { username: job.recipientUsername, name: contact.name });
    const buttons = applyTracking(extractButtons(automation.dmBlocks), automation.trackedLinks, automation.trackClicks, this.publicUrl(), job.recipientIgsid);

    const result = job.commentId
      ? await this.meta.sendCommentDm(igUserId, token, job.commentId, text, buttons)
      : await this.meta.sendDirectMessage(igUserId, token, job.recipientIgsid, text, buttons);

    if (!result.ok) {
      await this.recordRun(job, contact.id, 'FAILED', result.error);
      if (result.retryable) throw new Error(`Retryable Meta error: ${result.error}`);
      return;
    }

    await this.recordRun(job, contact.id, 'SENT');
    await this.prisma.contact.update({ where: { id: contact.id }, data: { dmsSent: { increment: 1 } } });

    // Schedule follow-ups (each within the 24h window).
    await this.scheduleFollowUps(automation.followUps, job);
  }

  private async scheduleFollowUps(followUps: { id: string; delayMinutes: number }[], job: DmJob) {
    const sentAt = new Date().toISOString();
    for (const fu of followUps) {
      const delayMs = Math.min(Math.max(fu.delayMinutes, 0) * 60_000, WINDOW_MS - 60_000);
      await this.dmQueue.add(
        'send',
        { ...job, followUpId: fu.id, primarySentAt: sentAt },
        { jobId: `${job.triggerEventId}:fu:${fu.id}`, delay: delayMs },
      );
    }
  }

  // ---------- follow-up DM ----------
  private async processFollowUp(job: DmJob): Promise<void> {
    const fu = await this.prisma.followUp.findUnique({
      where: { id: job.followUpId! },
      include: { automation: { include: { igAccount: true } } },
    });
    if (!fu || fu.automation.status !== 'LIVE') return;

    // 24h window guard.
    const since = job.primarySentAt ? Date.now() - new Date(job.primarySentAt).getTime() : 0;
    if (since >= WINDOW_MS) { this.log.debug(`Follow-up ${fu.id} skipped: outside 24h window`); return; }

    const contact = await this.prisma.contact.findUnique({
      where: { igAccountId_igScopedId: { igAccountId: job.igAccountId, igScopedId: job.recipientIgsid } },
    });

    // Condition gate.
    const ok = await this.conditionHolds(fu.condition, fu.automationId, job, contact?.lastReplyAt ?? null);
    if (!ok) { this.log.debug(`Follow-up ${fu.id} condition ${fu.condition} not met — skipped`); return; }

    const token = this.enc.decrypt(fu.automation.igAccount.accessTokenEnc);
    const igUserId = fu.automation.igAccount.igUserId;
    const blocks = fu.dmBlocks;
    const textBlock = (Array.isArray(blocks) ? blocks : []).find((b: any) => b?.type === 'text') as any;
    const text = personalize(textBlock?.text ?? 'Just following up!', { username: job.recipientUsername, name: contact?.name });
    const buttons = applyTracking(extractButtons(blocks), [], true, this.publicUrl(), job.recipientIgsid);

    // Follow-ups always go as a direct message (the comment thread is done).
    const result = await this.meta.sendDirectMessage(igUserId, token, job.recipientIgsid, text, buttons);
    if (!result.ok && result.retryable) throw new Error(`Retryable Meta error: ${result.error}`);
    if (result.ok && contact) await this.prisma.contact.update({ where: { id: contact.id }, data: { dmsSent: { increment: 1 } } });
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

  private publicUrl() { return this.config.get<string>('PUBLIC_URL', 'http://localhost:4000'); }

  private async recordRun(job: DmJob, contactId: string, status: 'SENT' | 'SKIPPED' | 'FAILED', error?: string) {
    await this.prisma.run.upsert({
      where: { triggerEventId: job.triggerEventId },
      create: { automationId: job.automationId, igAccountId: job.igAccountId, contactId, triggerEventId: job.triggerEventId, status, error, sentAt: status === 'SENT' ? new Date() : null },
      update: { status, error, sentAt: status === 'SENT' ? new Date() : null },
    });
  }
}
