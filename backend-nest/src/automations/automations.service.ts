import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAutomationDto } from './automations.dto';
import { computeHealth } from './health';
import { PLANS, Tier } from '../common/plan.config';

@Injectable()
export class AutomationsService {
  constructor(private prisma: PrismaService) {}

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
  private enforcePlan(plan: string, dto: Partial<CreateAutomationDto>) {
    const f = (PLANS[plan as Tier] ?? PLANS.FREE).features;
    if ((dto.keywords?.length ?? 0) > f.keywordsPerAutomation) {
      throw new BadRequestException(`Your plan allows ${f.keywordsPerAutomation} keyword(s) per automation`);
    }
    const paidTriggers = ['STORY_REPLY', 'LIVE_COMMENT', 'DM', 'ANY_POST'];
    if (dto.triggerType && paidTriggers.includes(dto.triggerType) && !f.paidTriggers) {
      throw new BadRequestException('This trigger needs a higher plan');
    }
    if ((dto.askToFollow && !f.askToFollow) || (dto.collectEmail && !f.collectEmail)) {
      throw new BadRequestException('Ask-to-follow and email collection need a higher plan');
    }
    if (dto.followUps?.length && !f.followUps) {
      throw new BadRequestException('Follow-ups need a higher plan');
    }
  }

  async create(userId: string, userPlan: string, dto: CreateAutomationDto) {
    await this.assertOwnsAccount(userId, dto.igAccountId);
    this.enforcePlan(userPlan, dto);
    const automation = await this.prisma.automation.create({
      data: {
        igAccountId: dto.igAccountId, name: dto.name, triggerType: dto.triggerType, mediaId: dto.mediaId ?? null,
        matchMode: dto.matchMode, keywords: dto.keywords, publicReplies: dto.publicReplies,
        replyToComment: dto.replyToComment, askToFollow: dto.askToFollow, collectEmail: dto.collectEmail,
        trackClicks: dto.trackClicks, dmBlocks: dto.dmBlocks as object, status: dto.status,
      },
    });
    if (dto.trackClicks) await this.syncTrackedLinks(automation.id, dto.dmBlocks);
    if (dto.followUps?.length) {
      await this.prisma.followUp.createMany({
        data: dto.followUps.map((f, i) => ({ automationId: automation.id, order: f.order ?? i, condition: f.condition, delayMinutes: f.delayMinutes, dmBlocks: f.dmBlocks as object })),
      });
    }
    return automation;
  }

  async list(userId: string) {
    const items = await this.prisma.automation.findMany({
      where: { igAccount: { userId } },
      orderBy: { createdAt: 'desc' },
      include: { igAccount: { select: { tokenExpiresAt: true, isActive: true } }, _count: { select: { runs: true } } },
    });
    const since = new Date(Date.now() - 86400000);
    return Promise.all(items.map(async (a: typeof items[number]) => {
      const recentFailures = await this.prisma.run.count({ where: { automationId: a.id, status: 'FAILED', createdAt: { gte: since } } });
      const health = computeHealth({ status: a.status, tokenExpiresAt: a.igAccount.tokenExpiresAt, recentFailures });
      return { ...a, health };
    }));
  }

  async get(userId: string, id: string) {
    await this.assertOwnsAutomation(userId, id);
    const a = await this.prisma.automation.findUnique({
      where: { id },
      include: { igAccount: { select: { username: true, tokenExpiresAt: true } }, followUps: { orderBy: { order: 'asc' } }, trackedLinks: true, _count: { select: { runs: true } } },
    });
    if (!a) return a;
    const since = new Date(Date.now() - 86400000);
    const recentFailures = await this.prisma.run.count({ where: { automationId: id, status: 'FAILED', createdAt: { gte: since } } });
    return { ...a, health: computeHealth({ status: a.status, tokenExpiresAt: a.igAccount.tokenExpiresAt, recentFailures }) };
  }

  // Delivery log — paginated runs, newest first.
  async runs(userId: string, id: string, cursor?: string, limit = 25) {
    await this.assertOwnsAutomation(userId, id);
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.run.findMany({
      where: { automationId: id },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { contact: { select: { username: true } } },
    });
    const nextCursor = rows.length > take ? rows[take - 1].id : null;
    return {
      runs: rows.slice(0, take).map((r: typeof rows[number]) => ({
        id: r.id, status: r.status, error: r.error, createdAt: r.createdAt, sentAt: r.sentAt,
        username: r.contact?.username ?? null,
      })),
      nextCursor,
    };
  }

  async update(userId: string, userPlan: string, id: string, dto: Partial<CreateAutomationDto>) {
    await this.assertOwnsAutomation(userId, id);
    this.enforcePlan(userPlan, dto);
    const data: Record<string, unknown> = { ...dto };
    if (dto.dmBlocks) data.dmBlocks = dto.dmBlocks as object;
    delete (data as any).igAccountId;
    const updated = await this.prisma.automation.update({ where: { id }, data });
    if (dto.dmBlocks && updated.trackClicks) await this.syncTrackedLinks(id, dto.dmBlocks);
    if (dto.followUps) {
      await this.prisma.followUp.deleteMany({ where: { automationId: id } });
      if (dto.followUps.length) {
        await this.prisma.followUp.createMany({
          data: dto.followUps.map((f, i) => ({ automationId: id, order: f.order ?? i, condition: f.condition, delayMinutes: f.delayMinutes, dmBlocks: f.dmBlocks as object })),
        });
      }
    }
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.assertOwnsAutomation(userId, id);
    await this.prisma.automation.delete({ where: { id } });
    return { success: true };
  }

  async setStatus(userId: string, id: string, status: 'DRAFT' | 'LIVE' | 'PAUSED') {
    await this.assertOwnsAutomation(userId, id);
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
  private async syncTrackedLinks(automationId: string, dmBlocks: unknown) {
    const blocks = Array.isArray(dmBlocks) ? dmBlocks : [];
    const urls = new Set<string>();
    for (const b of blocks as any[]) {
      if (b?.type === 'buttons') for (const btn of b.buttons ?? []) if (btn?.url) urls.add(btn.url);
    }
    for (const url of urls) {
      const existing = await this.prisma.trackedLink.findFirst({ where: { automationId, targetUrl: url } });
      if (!existing) {
        await this.prisma.trackedLink.create({ data: { automationId, targetUrl: url, slug: randomBytes(5).toString('hex') } });
      }
    }
  }
}
