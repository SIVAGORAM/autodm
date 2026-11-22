import { ForbiddenException, Injectable, NotFoundException, BadRequestException, ConflictException, ServiceUnavailableException, Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DM_QUEUE_TOKEN } from '../queue/queue.constants';
import { DmJob, runEventId } from '../queue/queue.constants';
import { DmQuotaService } from '../common/dm-quota.service';
import { CreateAutomationDto, UpdateAutomationDto } from './automations.dto';
import { computeHealth } from './health';
import { PLANS, Tier } from '../common/plan.config';
import { automationRestriction } from '../common/automation-entitlement';
import { accountPlanRestriction, planFor } from '../common/plan.util';
import { EncryptionService } from '../common/encryption.service';
import { InstagramService } from '../instagram/instagram.service';
import { hasFreshWorkerHeartbeat } from '../queue/worker-health';

const unsupportedFollowUpConditions = new Set(['BOUGHT', 'NOT_BOUGHT', 'FORM_NOT_SUBMITTED']);

@Injectable()
export class AutomationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(DM_QUEUE_TOKEN) private dmQueue: Queue<DmJob>,
    private quota: DmQuotaService,
    private readonly instagram: InstagramService,
    private readonly encryption: EncryptionService,
  ) {}

  private async assertOwnsAccount(userId: string, igAccountId: string) {
    const acc = await this.prisma.igAccount.findUnique({ where: { id: igAccountId } });
    if (!acc) throw new NotFoundException('Instagram account not found');
    if (acc.userId !== userId) throw new ForbiddenException('Not your account');
    return acc;
  }

  private async assertOwnsAutomation(userId: string, id: string) {
    const a = await this.prisma.automation.findUnique({ where: { id }, include: { igAccount: true } });
    if (!a) throw new NotFoundException('Automation not found');
    if (a.igAccount.userId !== userId) throw new ForbiddenException('Not your automation');
    return a;
  }

  // Per-tier feature gating. Enforced server-side on every create/update, not just in the UI.
  private enforcePlan(plan: string, dto: {
    triggerType?: string;
    matchMode?: string;
    keywords?: string[];
    askToFollow?: boolean;
    collectEmail?: boolean;
    followUps?: unknown[];
  }) {
    const reason = automationRestriction(PLANS[plan as Tier] ?? PLANS.FREE, {
      triggerType: dto.triggerType,
      matchMode: dto.matchMode,
      keywords: dto.keywords,
      askToFollow: dto.askToFollow,
      collectEmail: dto.collectEmail,
      followUpCount: dto.followUps?.length,
    });
    if (reason) throw new BadRequestException(reason);
  }

  private enforceCommentFollowUpPolicy(triggerType: string, followUps: Array<{ condition: string }> | undefined) {
    if (['POST_COMMENT', 'ANY_POST'].includes(triggerType) && followUps?.some((step) => step.condition === 'NO_REPLY')) {
      throw new BadRequestException('A comment private reply cannot be followed by an unsolicited message. The commenter must reply first; this follow-up condition is not available for comment automations.');
    }
  }

  private needsWebhookSubscription(triggerType: string) {
    return ['POST_COMMENT', 'ANY_POST', 'STORY_REPLY', 'DM'].includes(triggerType);
  }

  private requireWebhookSubscription(triggerType: string, subscribedAt: Date | null | undefined) {
    if (this.needsWebhookSubscription(triggerType) && !subscribedAt) {
      throw new BadRequestException('Instagram comment and message webhooks are not confirmed for this account. Set up webhooks from the Instagram account page before turning on this automation.');
    }
  }

  private async requireDeliveryWorker() {
    if (!(await hasFreshWorkerHeartbeat(this.dmQueue))) {
      throw new ServiceUnavailableException('The DM delivery worker is offline. This automation cannot be set live until delivery processing is available. Please try again shortly.');
    }
  }

  private requireSpecificCommentMedia(triggerType: string, mediaId: string | null | undefined) {
    if (triggerType === 'POST_COMMENT' && !mediaId?.trim()) {
      throw new BadRequestException('Choose a specific post, photo, carousel, or video/Reel. Use “Comment on any post” for account-wide coverage.');
    }
  }

  private async verifySpecificCommentMedia(account: { accessTokenEnc: string; loginMode: 'INSTAGRAM_LOGIN' | 'UNIFIED_LOGIN'; igUserId: string }, triggerType: string, mediaId: string | null | undefined) {
    if (triggerType !== 'POST_COMMENT') return;
    this.requireSpecificCommentMedia(triggerType, mediaId);
    const metadata = await this.instagram.getMediaMetadata(
      this.encryption.decrypt(account.accessTokenEnc), mediaId!, account.loginMode,
    );
    if (metadata.ownerId !== account.igUserId) {
      throw new BadRequestException('Choose a post published by the connected Instagram account.');
    }
    if (!['IMAGE', 'CAROUSEL_ALBUM', 'VIDEO'].includes(metadata.media_type.toUpperCase())) {
      throw new BadRequestException('Choose an Instagram photo, carousel, or video/Reel.');
    }
  }

  async create(userId: string, userPlan: string, dto: CreateAutomationDto) {
    const account = await this.assertOwnsAccount(userId, dto.igAccountId);
    this.enforceCommentFollowUpPolicy(dto.triggerType, dto.followUps);
    if (dto.status === 'LIVE') this.requireWebhookSubscription(dto.triggerType, account.webhookSubscribedAt);
    this.enforcePlan(userPlan, dto);
    await this.verifySpecificCommentMedia(account, dto.triggerType, dto.mediaId);
    if (dto.status === 'LIVE') {
      const reason = await this.accountRestriction(userId, dto.igAccountId, userPlan);
      if (reason) throw new BadRequestException(reason);
      await this.requireDeliveryWorker();
    }
    return this.prisma.$transaction(async (tx) => {
      const automation = await tx.automation.create({
        data: {
          igAccountId: dto.igAccountId, name: dto.name, triggerType: dto.triggerType, mediaId: dto.mediaId ?? null,
          matchMode: dto.matchMode, keywords: dto.keywords, publicReplies: dto.publicReplies,
          replyToComment: dto.replyToComment, askToFollow: dto.askToFollow, collectEmail: dto.collectEmail,
          trackClicks: dto.trackClicks, dmBlocks: dto.dmBlocks as object, status: dto.status,
        },
      });
      if (dto.followUps?.length) {
        await tx.followUp.createMany({
          data: dto.followUps.map((f, i) => ({ automationId: automation.id, order: f.order ?? i, condition: f.condition, delayMinutes: f.delayMinutes, dmBlocks: f.dmBlocks as object })),
        });
      }
      if (dto.trackClicks) {
        await this.syncTrackedLinks(tx, automation.id, [
          dto.dmBlocks,
          ...(dto.followUps ?? []).map((followUp) => followUp.dmBlocks),
        ]);
      }
      return automation;
    });
  }

  async list(userId: string) {
    const items = await this.prisma.automation.findMany({
      where: { igAccount: { userId } },
      orderBy: { createdAt: 'desc' },
      include: { igAccount: { select: { id: true, tokenExpiresAt: true, isActive: true, webhookSubscribedAt: true } }, _count: { select: { runs: true, followUps: true } } },
    });
    const since = new Date(Date.now() - 86400000);
    if (!items.length) return [];
    const deliveryWorkerUnavailable = !(await hasFreshWorkerHeartbeat(this.dmQueue));
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true, trialEndsAt: true } });
    const plan = planFor(user);
    const activeAccountIds = await this.activeAccountIds(userId);
    const failureGroups = await this.prisma.run.groupBy({
      by: ['automationId'],
      where: { automationId: { in: items.map((a) => a.id) }, status: { in: ['FAILED', 'UNKNOWN'] }, createdAt: { gte: since } },
      _count: { automationId: true },
    });
    const failuresByAutomation = new Map(failureGroups.map((group) => [group.automationId, group._count.automationId]));
    const sentGroups = await this.prisma.run.groupBy({
      by: ['automationId'],
      where: { automationId: { in: items.map((a) => a.id) }, status: 'SENT' },
      _count: { automationId: true },
    });
    const sentByAutomation = new Map(sentGroups.map((group) => [group.automationId, group._count.automationId]));
    return items.map((a: typeof items[number]) => {
      const recentFailures = failuresByAutomation.get(a.id) ?? 0;
      const sentCount = sentByAutomation.get(a.id) ?? 0;
      const planRestriction = accountPlanRestriction(plan, activeAccountIds, a.igAccount.id)
        ?? automationRestriction(plan, { ...a, followUpCount: a._count.followUps });
      const health = computeHealth({
        status: a.status, tokenExpiresAt: a.igAccount.tokenExpiresAt, recentFailures, planRestriction,
        webhookSubscriptionMissing: this.needsWebhookSubscription(a.triggerType) && !a.igAccount.webhookSubscribedAt,
        deliveryWorkerUnavailable,
      });
      return { ...a, sentCount, health };
    });
  }

  async get(userId: string, id: string) {
    const owned = await this.assertOwnsAutomation(userId, id);
    const [a, user, activeAccountIds] = await Promise.all([
      this.prisma.automation.findUnique({
      where: { id },
        include: { igAccount: { select: { username: true, tokenExpiresAt: true, webhookSubscribedAt: true } }, followUps: { orderBy: { order: 'asc' } }, trackedLinks: true, _count: { select: { runs: true } } },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true, trialEndsAt: true } }),
      this.activeAccountIds(userId),
    ]);
    if (!a) return a;
    const deliveryWorkerUnavailable = !(await hasFreshWorkerHeartbeat(this.dmQueue));
    const since = new Date(Date.now() - 86400000);
    const recentFailures = await this.prisma.run.count({ where: { automationId: id, status: { in: ['FAILED', 'UNKNOWN'] }, createdAt: { gte: since } } });
    const plan = planFor(user);
    const planRestriction = accountPlanRestriction(plan, activeAccountIds, owned.igAccountId)
      ?? automationRestriction(plan, { ...a, followUpCount: a.followUps.length });
    return {
      ...a,
      health: computeHealth({
        status: a.status, tokenExpiresAt: a.igAccount.tokenExpiresAt, recentFailures, planRestriction,
        webhookSubscriptionMissing: this.needsWebhookSubscription(a.triggerType) && !a.igAccount.webhookSubscribedAt,
        deliveryWorkerUnavailable,
      }),
    };
  }

  // Delivery log — paginated runs, newest first.
  async runs(userId: string, id: string, cursor?: string, limit = 25) {
    await this.assertOwnsAutomation(userId, id);
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.run.findMany({
      where: { automationId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { contact: { select: { username: true } } },
    });
    const nextCursor = rows.length > take ? rows[take - 1].id : null;
    return {
      runs: rows.slice(0, take).map((r: typeof rows[number]) => ({
        id: r.id, status: r.status, error: r.error, createdAt: r.createdAt, sentAt: r.sentAt,
        followUpOrder: r.followUpOrder,
        username: r.contact?.username ?? null,
      })),
      nextCursor,
    };
  }

  async update(userId: string, userPlan: string, id: string, dto: UpdateAutomationDto) {
    const existing = await this.assertOwnsAutomation(userId, id);
    const effectiveTriggerType = dto.triggerType ?? existing.triggerType;
    let storedFollowUps: Array<{ id: string; condition: string }> | undefined;
    if (dto.followUps || dto.triggerType) {
      storedFollowUps = await this.prisma.followUp.findMany({
        where: { automationId: id }, select: { id: true, condition: true },
      });
    }
    if (dto.followUps) {
      const storedConditions = new Map((storedFollowUps ?? []).map((item) => [item.id, item.condition]));
      for (const followUp of dto.followUps) {
        if (!unsupportedFollowUpConditions.has(followUp.condition)) continue;
        // Legacy conditions can remain untouched while a creator edits other
        // fields, but they cannot be added or reintroduced through the API.
        if (!followUp.id || storedConditions.get(followUp.id) !== followUp.condition) {
          throw new BadRequestException('Purchase and form-based follow-ups are unavailable until those integrations are implemented. Choose a supported condition instead.');
        }
      }
    }
    if (dto.status === 'LIVE' || existing.status === 'LIVE') {
      this.requireWebhookSubscription(effectiveTriggerType, existing.igAccount.webhookSubscribedAt);
    }
    if (dto.followUps || (dto.triggerType && ['POST_COMMENT', 'ANY_POST'].includes(effectiveTriggerType))) {
      const followUps = dto.followUps ?? storedFollowUps ?? [];
      this.enforceCommentFollowUpPolicy(effectiveTriggerType, followUps);
    }
    this.enforcePlan(userPlan, dto);
    if (dto.status === 'LIVE') {
      const currentFollowUps = dto.followUps?.length ?? await this.prisma.followUp.count({ where: { automationId: id } });
      const restriction = automationRestriction(PLANS[userPlan as Tier] ?? PLANS.FREE, {
        ...existing,
        ...dto,
        followUpCount: currentFollowUps,
      });
      if (restriction) throw new BadRequestException(restriction);
      const accountReason = await this.accountRestriction(userId, existing.igAccountId, userPlan);
      if (accountReason) throw new BadRequestException(accountReason);
      await this.requireDeliveryWorker();
    }
    await this.verifySpecificCommentMedia(
      existing.igAccount,
      effectiveTriggerType,
      dto.mediaId === undefined ? existing.mediaId : dto.mediaId,
    );
    const data: Record<string, unknown> = { ...dto };
    if (dto.dmBlocks) data.dmBlocks = dto.dmBlocks as object;
    delete (data as any).igAccountId;
    delete data.followUps;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.automation.update({ where: { id }, data });
      if (dto.followUps) {
        const existing = await tx.followUp.findMany({ where: { automationId: id }, select: { id: true } });
        const existingIds = new Set(existing.map((step: { id: string }) => step.id));
        const retainedIds = new Set<string>();
        for (const [index, followUp] of dto.followUps.entries()) {
          const stepData = {
            order: followUp.order ?? index,
            condition: followUp.condition,
            delayMinutes: followUp.delayMinutes,
            dmBlocks: followUp.dmBlocks as object,
          };
          if (followUp.id) {
            if (!existingIds.has(followUp.id) || retainedIds.has(followUp.id)) {
              throw new BadRequestException('A follow-up step does not belong to this automation.');
            }
            retainedIds.add(followUp.id);
            await tx.followUp.update({ where: { id: followUp.id }, data: stepData });
          } else {
            const created = await tx.followUp.create({ data: { automationId: id, ...stepData }, select: { id: true } });
            retainedIds.add(created.id);
          }
        }
        const removedIds = [...existingIds].filter((stepId) => !retainedIds.has(stepId));
        if (removedIds.length) {
          await tx.followUp.deleteMany({ where: { automationId: id, id: { in: removedIds } } });
        }
      }
      if (updated.trackClicks && (dto.trackClicks === true || dto.dmBlocks || dto.followUps)) {
        const currentFollowUps = await tx.followUp.findMany({ where: { automationId: id }, select: { dmBlocks: true } });
        await this.syncTrackedLinks(tx, id, [updated.dmBlocks, ...currentFollowUps.map((followUp: { dmBlocks: unknown }) => followUp.dmBlocks)]);
      }
      return updated;
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwnsAutomation(userId, id);
    await this.prisma.automation.update({ where: { id }, data: { status: 'PAUSED' } });

    // Stop new webhook matches, remove all pending/delayed sends for this
    // automation, then wait for already-active sends to finish before cascade
    // deleting the rows their workers may still need to update.
    const deadline = Date.now() + 15_000;
    try {
      while (true) {
        const pending = await this.jobsForAutomation(['waiting', 'delayed', 'paused', 'waiting-children'], id);
        if (pending.length) {
          await Promise.all(pending.map(async (job) => {
            await job.remove();
            await this.quota.settle(runEventId(job.data), false);
          }));
          continue;
        }
        const active = await this.jobsForAutomation(['active'], id);
        if (!active.length) break;
        if (Date.now() >= deadline) {
          throw new ConflictException('The automation is paused while in-progress messages finish. Retry deletion shortly.');
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      // Recover reservations if a queue job was removed successfully but the
      // corresponding database settlement failed during an earlier attempt.
      await this.quota.settleUnstartedForAutomation(id);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException('The automation is paused, but queued messages could not be cleared. Retry deletion when the queue is available.');
    }

    await this.prisma.automation.delete({ where: { id } });
    return { success: true };
  }

  private async jobsForAutomation(states: Array<'waiting' | 'delayed' | 'paused' | 'waiting-children' | 'active'>, automationId: string): Promise<Job<DmJob>[]> {
    const matching: Job<DmJob>[] = [];
    const pageSize = 500;
    for (let start = 0; ; start += pageSize) {
      const page = await this.dmQueue.getJobs(states, start, start + pageSize - 1);
      matching.push(...page.filter((job) => job.data?.automationId === automationId));
      if (page.length < pageSize) break;
    }
    return matching;
  }

  async setStatus(userId: string, userPlan: string, id: string, status: 'DRAFT' | 'LIVE' | 'PAUSED') {
    const existing = await this.assertOwnsAutomation(userId, id);
    if (status === 'LIVE') {
      this.requireWebhookSubscription(existing.triggerType, existing.igAccount.webhookSubscribedAt);
      const followUps = await this.prisma.followUp.findMany({ where: { automationId: id }, select: { condition: true } });
      this.enforceCommentFollowUpPolicy(existing.triggerType, followUps);
      const followUpCount = await this.prisma.followUp.count({ where: { automationId: id } });
      const reason = automationRestriction(PLANS[userPlan as Tier] ?? PLANS.FREE, {
        triggerType: existing.triggerType,
        mediaId: existing.mediaId,
        matchMode: existing.matchMode,
        keywords: existing.keywords,
        askToFollow: existing.askToFollow,
        collectEmail: existing.collectEmail,
        followUpCount,
      });
      if (reason) throw new BadRequestException(reason);
      const accountReason = await this.accountRestriction(userId, existing.igAccountId, userPlan);
      if (accountReason) throw new BadRequestException(accountReason);
      await this.requireDeliveryWorker();
      await this.verifySpecificCommentMedia(existing.igAccount, existing.triggerType, existing.mediaId);
    }
    return this.prisma.automation.update({ where: { id }, data: { status } });
  }

  async analytics(userId: string, id: string) {
    await this.assertOwnsAutomation(userId, id);
    const [runs, sent, clicks] = await Promise.all([
      this.prisma.run.count({ where: { automationId: id } }),
      this.prisma.run.count({ where: { automationId: id, status: 'SENT' } }),
      this.prisma.trackedLink.aggregate({ where: { automationId: id }, _sum: { clicks: true } }),
    ]);
    return { runs, sent, clicks: clicks._sum.clicks ?? 0 };
  }

  // Create a TrackedLink row per button URL so the processor can wrap them.
  private async syncTrackedLinks(tx: Prisma.TransactionClient, automationId: string, messageBlocks: unknown) {
    const messages = Array.isArray(messageBlocks) ? messageBlocks : [messageBlocks];
    const urls = new Set<string>();
    for (const blocks of messages) {
      if (!Array.isArray(blocks)) continue;
      for (const block of blocks as any[]) {
        if (block?.type === 'buttons') for (const button of block.buttons ?? []) if (button?.url) urls.add(button.url);
      }
    }
    for (const url of urls) {
      const existing = await tx.trackedLink.findFirst({ where: { automationId, targetUrl: url } });
      if (!existing) {
        await tx.trackedLink.create({ data: { automationId, targetUrl: url, slug: randomBytes(5).toString('hex') } });
      }
    }
  }

  private async activeAccountIds(userId: string): Promise<string[]> {
    const accounts = await this.prisma.igAccount.findMany({
      where: { userId, isActive: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return accounts.map((account) => account.id);
  }

  private async accountRestriction(userId: string, igAccountId: string, userPlan: string) {
    return accountPlanRestriction(PLANS[userPlan as Tier] ?? PLANS.FREE, await this.activeAccountIds(userId), igAccountId);
  }
}
