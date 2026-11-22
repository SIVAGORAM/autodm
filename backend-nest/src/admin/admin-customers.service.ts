import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCustomersQuery } from './admin.dto';

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminCustomersQuery) {
    const where: Prisma.UserWhereInput = { role: 'INFLUENCER' };
    if (query.search) {
      where.OR = [
        { id: query.search },
        { email: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.plan) where.plan = query.plan;
    if (query.status === 'ACTIVE') { where.suspendedAt = null; where.deletionRequestedAt = null; }
    if (query.status === 'SUSPENDED') { where.suspendedAt = { not: null }; where.deletionRequestedAt = null; }
    if (query.status === 'PENDING_DELETION') where.deletionRequestedAt = { not: null };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true, name: true, email: true, plan: true, planExpiresAt: true, isVerified: true,
          createdAt: true, suspendedAt: true, suspensionReason: true, deletionRequestedAt: true,
          igAccounts: { select: { isActive: true, _count: { select: { automations: true } } } },
        },
      }),
    ]);
    const customers = rows.map(({ igAccounts, ...customer }) => ({
      ...customer,
      instagramAccountCount: igAccounts.length,
      activeInstagramAccountCount: igAccounts.filter((account) => account.isActive).length,
      automationCount: igAccounts.reduce((sum, account) => sum + account._count.automations, 0),
    }));
    return { page: query.page, pageSize: query.pageSize, total, customers, hasMore: query.page * query.pageSize < total };
  }

  async detail(id: string) {
    const customer = await this.prisma.user.findFirst({
      where: { id, role: 'INFLUENCER' },
      select: {
        id: true, name: true, email: true, plan: true, planExpiresAt: true, trialEndsAt: true,
        isVerified: true, createdAt: true, updatedAt: true, suspendedAt: true, suspensionReason: true,
        deletionRequestedAt: true,
        igAccounts: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true, username: true, loginMode: true, isActive: true, tokenExpiresAt: true,
            webhookSubscribedAt: true, createdAt: true,
            automations: { orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], select: { id: true, name: true, triggerType: true, status: true, updatedAt: true } },
          },
        },
        _count: { select: { supportRequests: true, payments: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found.');
    return customer;
  }

  async suspend(actorId: string, id: string, reason: string) {
    return this.changeLifecycle(actorId, id, reason, 'SUSPEND');
  }

  async reactivate(actorId: string, id: string, reason: string) {
    return this.changeLifecycle(actorId, id, reason, 'REACTIVATE');
  }

  private async changeLifecycle(actorId: string, id: string, reason: string, action: 'SUSPEND' | 'REACTIVATE') {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, role: true, suspendedAt: true, suspensionReason: true, deletionRequestedAt: true, sessionVersion: true },
      });
      if (!target || target.role !== 'INFLUENCER') throw new NotFoundException('Customer not found.');
      if (target.deletionRequestedAt) throw new ConflictException('Customer deletion is already in progress; complete the deletion workflow instead.');
      if (action === 'SUSPEND' && target.suspendedAt) return { changed: false, status: 'SUSPENDED' };
      if (action === 'REACTIVATE' && !target.suspendedAt) return { changed: false, status: 'ACTIVE' };

      const changedAt = new Date();
      const update = await tx.user.updateMany({
        where: {
          id, role: UserRole.INFLUENCER, deletionRequestedAt: null,
          suspendedAt: action === 'SUSPEND' ? null : { not: null },
        },
        data: action === 'SUSPEND'
          ? { suspendedAt: changedAt, suspensionReason: reason, sessionVersion: { increment: 1 } }
          : { suspendedAt: null, suspensionReason: null, sessionVersion: { increment: 1 } },
      });
      if (update.count !== 1) throw new ConflictException('This customer changed while the request was being processed. Refresh and try again.');

      await tx.refreshToken.deleteMany({ where: { userId: id } });
      let pausedAutomations = 0;
      if (action === 'SUSPEND') {
        const paused = await tx.automation.updateMany({
          where: { igAccount: { userId: id }, status: 'LIVE' },
          data: { status: 'PAUSED' },
        });
        pausedAutomations = paused.count;
      }

      const requestId = randomUUID();
      await tx.adminAuditEvent.create({
        data: {
          actorId, action: action === 'SUSPEND' ? 'CUSTOMER_SUSPENDED' : 'CUSTOMER_REACTIVATED',
          targetType: 'USER', targetId: id, reason, requestId,
          before: { suspendedAt: target.suspendedAt, sessionVersion: target.sessionVersion } as Prisma.InputJsonValue,
          after: { suspendedAt: action === 'SUSPEND' ? changedAt.toISOString() : null, sessionVersion: target.sessionVersion + 1 } as Prisma.InputJsonValue,
        },
      });
      return {
        changed: true, requestId, status: action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE',
        pausedAutomations, automationsRemainPaused: action === 'REACTIVATE',
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
