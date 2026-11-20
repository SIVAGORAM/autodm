import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DM_QUEUE_TOKEN } from '../queue/queue.module';
import { DmJob } from '../queue/queue.constants';
import { matchComment, MatchMode } from '../automations/matcher';
import { planFor } from '../common/plan.util';

// Turns a raw Instagram webhook payload into DM jobs. Fast: it only reads
// and enqueues, never calls Meta, so the webhook can return 200 immediately.
@Injectable()
export class WebhookService {
  private readonly log = new Logger(WebhookService.name);
  constructor(
    private prisma: PrismaService,
    @Inject(DM_QUEUE_TOKEN) private dmQueue: Queue,
  ) {}

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
    const igUserId = String(entry.id);
    const commentId = String(value.id);
    const text: string = value.text ?? '';
    const fromId = String(value.from?.id ?? '');
    const fromUser = value.from?.username as string | undefined;
    const mediaId = String(value.media?.id ?? '');
    if (!fromId || !commentId) return;

    const account = await this.prisma.igAccount.findUnique({ where: { igUserId } });
    if (!account) return;

    // Don't reply to the creator's own comments.
    if (fromId === igUserId) return;

    const automations = await this.prisma.automation.findMany({
      where: {
        igAccountId: account.id,
        status: 'LIVE',
        triggerType: { in: ['POST_COMMENT', 'ANY_POST', 'NEXT_POST', 'LIVE_COMMENT'] },
        OR: [{ mediaId }, { mediaId: null }],
      },
    });

    for (const a of automations) {
      if (a.mediaId && a.mediaId !== mediaId) continue;
      const res = matchComment({ text, matchMode: a.matchMode as MatchMode, keywords: a.keywords });
      if (!res.matched) continue; // AI_INTENT deferral handled in a later pass
      if (!(await this.consumeQuota(account.userId))) { this.log.warn(`DM quota reached for user ${account.userId} — comment skipped`); break; }
      await this.enqueue({
        automationId: a.id, igAccountId: account.id, triggerType: a.triggerType,
        commentId, recipientIgsid: fromId, recipientUsername: fromUser,
        text: this.firstText(a.dmBlocks), matchedKeyword: res.keyword,
        triggerEventId: commentId,
      });
      break; // one automation per comment
    }
  }

  private async onMessage(entry: any, msg: any) {
    const igUserId = String(entry.id);
    const senderId = String(msg.sender?.id ?? '');
    const text: string = msg.message?.text ?? '';
    const mid = String(msg.message?.mid ?? '');
    if (!senderId || senderId === igUserId || !mid) return;
    if (msg.message?.is_echo) return;

    const account = await this.prisma.igAccount.findUnique({ where: { igUserId } });
    if (!account) return;

    // Record the reply so NO_REPLY follow-ups can tell they answered.
    await this.prisma.contact.upsert({
      where: { igAccountId_igScopedId: { igAccountId: account.id, igScopedId: senderId } },
      create: { igAccountId: account.id, igScopedId: senderId, lastReplyAt: new Date(), lastInteraction: new Date() },
      update: { lastReplyAt: new Date(), lastInteraction: new Date() },
    });

    // A story reply arrives as a message with reply_to.story; a plain DM does not.
    const kind = msg.message?.reply_to?.story ? 'STORY_REPLY' : 'DM';

    const automations = await this.prisma.automation.findMany({
      where: { igAccountId: account.id, status: 'LIVE', triggerType: kind },
    });
    for (const a of automations) {
      const res = matchComment({ text, matchMode: a.matchMode as MatchMode, keywords: a.keywords });
      if (!res.matched) continue;
      if (!(await this.consumeQuota(account.userId))) { this.log.warn(`DM quota reached for user ${account.userId} — message skipped`); break; }
      await this.enqueue({
        automationId: a.id, igAccountId: account.id, triggerType: kind,
        recipientIgsid: senderId, text: this.firstText(a.dmBlocks),
        matchedKeyword: res.keyword, triggerEventId: mid,
      });
      break;
    }
  }

  private firstText(dmBlocks: unknown): string {
    const blocks = Array.isArray(dmBlocks) ? dmBlocks : [];
    const t = (blocks as any[]).find(b => b?.type === 'text');
    return t?.text ?? 'Thanks for reaching out!';
  }

  // Monthly DM quota: atomically counts one DM against the user's plan limit.
  // Returns false when they're over the limit (the trigger is then skipped).
  // Counter resets lazily at the start of each calendar month — no cron needed.
  private async consumeQuota(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true, trialEndsAt: true, dmCount: true, dmCountResetAt: true },
    });
    if (!u) return false;
    const now = new Date();
    let count = u.dmCount;
    if (!u.dmCountResetAt || u.dmCountResetAt.getTime() <= now.getTime()) {
      const reset = new Date(now.getFullYear(), now.getMonth() + 1, 1); // first of next month, local
      await this.prisma.user.update({ where: { id: userId }, data: { dmCount: 0, dmCountResetAt: reset } });
      count = 0;
    }
    const quota = planFor(u).dmQuota;
    if (count >= quota) return false;
    await this.prisma.user.update({ where: { id: userId }, data: { dmCount: { increment: 1 } } });
    return true;
  }

  private async enqueue(job: DmJob) {
    // jobId = triggerEventId gives queue-level dedupe on top of the DB unique key.
    await this.dmQueue.add('send', job, { jobId: job.triggerEventId });
  }
}
