import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { DM_QUEUE_TOKEN } from '../queue/queue.constants';
import { WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_TTL_SECONDS } from '../queue/worker-health';

@Injectable()
export class AdminOperationsService {
  constructor(private readonly prisma: PrismaService, @Inject(DM_QUEUE_TOKEN) private readonly queue: Queue) {}

  async overview() {
    const now = new Date();
    const [customers, activeCustomers, suspendedCustomers, deletionRequests, adminAccounts, mfaPendingAdmins,
      instagramAccounts, activeInstagramAccounts, liveAutomations, failedRuns, openSupport, newEnquiries, failedMail, deadLetters] = await Promise.all([
      this.prisma.user.count({ where: { role: 'INFLUENCER' } }),
      this.prisma.user.count({ where: { role: 'INFLUENCER', suspendedAt: null, deletionRequestedAt: null } }),
      this.prisma.user.count({ where: { role: 'INFLUENCER', suspendedAt: { not: null }, deletionRequestedAt: null } }),
      this.prisma.user.count({ where: { role: 'INFLUENCER', deletionRequestedAt: { not: null } } }),
      this.prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, suspendedAt: null, deletionRequestedAt: null } }),
      this.prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, suspendedAt: null, deletionRequestedAt: null, adminMfaEnabledAt: null } }),
      this.prisma.igAccount.count(),
      this.prisma.igAccount.count({ where: { isActive: true } }),
      this.prisma.automation.count({ where: { status: 'LIVE' } }),
      this.prisma.run.count({ where: { status: 'FAILED' } }),
      this.prisma.supportRequest.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.contactEnquiry.count({ where: { status: 'NEW' } }),
      this.prisma.mailOutbox.count({ where: { status: 'FAILED' } }),
      this.prisma.webhookEvent.count({ where: { deadLetterAt: { not: null }, processedAt: null, payloadPurgedAt: null } }),
    ]);

    const [database, queueHealth] = await Promise.all([
      this.probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.readQueueHealth(now.getTime()),
    ]);
    return {
      generatedAt: now.toISOString(),
      metrics: {
        customers, activeCustomers, suspendedCustomers, deletionRequests, adminAccounts, mfaPendingAdmins,
        instagramAccounts, activeInstagramAccounts, liveAutomations, failedRuns, openSupport, newEnquiries, failedMail, deadLetters,
      },
      services: {
        database: database ? 'healthy' : 'unhealthy',
        queue: queueHealth.available ? 'healthy' : 'unknown',
        worker: queueHealth.workerAlive === null ? 'unknown' : queueHealth.workerAlive ? 'healthy' : 'degraded',
      },
      queue: queueHealth.available ? queueHealth.counts : null,
      workerLastHeartbeatAt: queueHealth.heartbeatAt,
    };
  }

  async auditEvents(page: number, pageSize: number, action?: string) {
    const where: Prisma.AdminAuditEventWhereInput = action ? { action: { contains: action, mode: 'insensitive' } } : {};
    const [total, events] = await this.prisma.$transaction([
      this.prisma.adminAuditEvent.count({ where }),
      this.prisma.adminAuditEvent.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize,
        select: {
          id: true, action: true, targetType: true, targetId: true, reason: true, requestId: true, createdAt: true,
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);
    return { page, pageSize, total, events, hasMore: page * pageSize < total };
  }

  async paymentLedger(input: {
    page: number; pageSize: number; search?: string; plan?: 'FREE' | 'CREATOR' | 'PRO' | 'AGENCY';
    currency?: string; from?: Date; to?: Date;
  }) {
    const where: Prisma.PaymentWhereInput = {};
    if (input.plan) where.plan = input.plan;
    if (input.currency) where.currency = input.currency.toUpperCase();
    if (input.from || input.to) where.createdAt = { gte: input.from, lte: input.to };
    if (input.search) {
      where.OR = [
        { orderId: { contains: input.search, mode: 'insensitive' } },
        { paymentId: { contains: input.search, mode: 'insensitive' } },
        { userId: input.search },
        { user: { is: { email: { contains: input.search, mode: 'insensitive' } } } },
        { user: { is: { name: { contains: input.search, mode: 'insensitive' } } } },
      ];
    }

    const [total, payments, capturedByCurrency] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize, take: input.pageSize,
        select: {
          id: true, orderId: true, paymentId: true, plan: true, amount: true, currency: true, createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.payment.groupBy({
        by: ['currency'], where,
        _count: { _all: true }, _sum: { amount: true },
        orderBy: { currency: 'asc' },
      }),
    ]);
    return {
      page: input.page, pageSize: input.pageSize, total,
      hasMore: input.page * input.pageSize < total,
      payments,
      recordedCaptures: capturedByCurrency.map((row) => ({
        currency: row.currency,
        count: row._count._all,
        amountMinorUnits: row._sum.amount ?? 0,
      })),
      limitations: ['Only provider-verified captured payments stored by HeyLaunch are listed.',
        'Refunds, reversals, failed-payment events, and subscription history are not stored in this ledger.'],
    };
  }

  private async readQueueHealth(now: number) {
    try {
      const [heartbeat, counts] = await Promise.all([
        (await this.queue.client).get(WORKER_HEARTBEAT_KEY),
        this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      ]);
      const time = heartbeat === null ? Number.NaN : Number(heartbeat);
      const ageMs = now - time;
      const valid = Number.isFinite(time) && ageMs >= 0;
      return {
        available: true, counts, heartbeatAt: valid ? new Date(time).toISOString() : null,
        workerAlive: valid ? ageMs <= WORKER_HEARTBEAT_TTL_SECONDS * 1000 : false,
      };
    } catch {
      return { available: false, counts: null, heartbeatAt: null, workerAlive: null };
    }
  }

  private async probe(operation: () => Promise<unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation().then(() => true, () => false),
        new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), 1_500); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
