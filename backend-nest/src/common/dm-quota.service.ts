import { Injectable } from '@nestjs/common';
import { DmQuotaReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { planFor } from './plan.util';

@Injectable()
export class DmQuotaService {
  constructor(private prisma: PrismaService) {}

  /** Atomically reserve one primary or follow-up DM against monthly and daily limits. */
  async consume(userId: string, automationId: string, dailyLimit: number, reservationKey: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true, trialEndsAt: true },
    });
    if (!user) return false;

    const now = new Date();
    const quota = planFor(user).dmQuota;
    const monthReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const dayReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    try {
      return await this.prisma.$transaction(async (tx) => {
        // A repeated webhook/worker attempt reuses its prior claim.
        const existing = await tx.dmQuotaReservation.findUnique({
          where: { triggerEventId: reservationKey },
          select: { status: true },
        });
        if (existing) return existing.status !== DmQuotaReservationStatus.RELEASED;
        const automation = await tx.automation.findUnique({ where: { id: automationId }, select: { dailyCountResetAt: true } });
        if (!automation) return false;

        await tx.user.updateMany({
          where: { id: userId, OR: [{ dmCountResetAt: null }, { dmCountResetAt: { lte: now } }] },
          data: { dmCount: 0, dmCountResetAt: monthReset },
        });
        await tx.automation.updateMany({
          where: { id: automationId, OR: [{ dailyCountResetAt: null }, { dailyCountResetAt: { lte: now } }] },
          data: { dailyCount: 0, dailyCountResetAt: dayReset },
        });

        const monthly = await tx.user.updateMany({
          where: { id: userId, dmCountResetAt: { gt: now }, dmCount: { lt: quota } },
          data: { dmCount: { increment: 1 } },
        });
        const daily = await tx.automation.updateMany({
          where: { id: automationId, dailyCountResetAt: { gt: now }, dailyCount: { lt: dailyLimit } },
          data: { dailyCount: { increment: 1 } },
        });
        if (monthly.count !== 1 || daily.count !== 1) throw new Error('QUOTA_LIMIT_REACHED');
        await tx.dmQuotaReservation.create({
          data: {
            triggerEventId: reservationKey,
            userId,
            automationId,
            status: DmQuotaReservationStatus.RESERVED,
            monthWindowEndsAt: monthReset,
            dayWindowEndsAt: dayReset,
          },
        });
        return true;
      });
    } catch (error: any) {
      if (error?.message === 'QUOTA_LIMIT_REACHED') return false;
      // Concurrent duplicate claims roll back their counter updates.
      if (error?.code === 'P2002') {
        const existing = await this.prisma.dmQuotaReservation.findUnique({
          where: { triggerEventId: reservationKey },
          select: { status: true },
        });
        return !!existing && existing.status !== DmQuotaReservationStatus.RELEASED;
      }
      throw error;
    }
  }

  /** Settle a queued DM once delivery is certain; unknown outcomes stay reserved. */
  async settle(reservationKey: string, delivered: boolean): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.dmQuotaReservation.findUnique({
        where: { triggerEventId: reservationKey },
        select: { status: true, userId: true, automationId: true, monthWindowEndsAt: true, dayWindowEndsAt: true },
      });
      if (!reservation || reservation.status !== DmQuotaReservationStatus.RESERVED) return;

      const status = delivered ? DmQuotaReservationStatus.CONSUMED : DmQuotaReservationStatus.RELEASED;
      const claimed = await tx.dmQuotaReservation.updateMany({
        where: { triggerEventId: reservationKey, status: DmQuotaReservationStatus.RESERVED },
        data: { status, settledAt: new Date() },
      });
      if (claimed.count !== 1 || delivered) return;

      // Only refund counters if they still represent this reservation's quota
      // window. A delayed delivery must not decrement a newer month/day count.
      if (reservation.monthWindowEndsAt) {
        await tx.user.updateMany({
          where: {
            id: reservation.userId,
            dmCountResetAt: reservation.monthWindowEndsAt,
            dmCount: { gt: 0 },
          },
          data: { dmCount: { decrement: 1 } },
        });
      }
      if (reservation.dayWindowEndsAt) {
        await tx.automation.updateMany({
          where: {
            id: reservation.automationId,
            dailyCountResetAt: reservation.dayWindowEndsAt,
            dailyCount: { gt: 0 },
          },
          data: { dailyCount: { decrement: 1 } },
        });
      }
    });
  }

  /** Release claims that never reached a worker when an automation is deleted. */
  async settleUnstartedForAutomation(automationId: string): Promise<void> {
    const reservations = await this.prisma.dmQuotaReservation.findMany({
      where: { automationId, status: DmQuotaReservationStatus.RESERVED },
      select: { triggerEventId: true },
    });
    if (!reservations.length) return;

    const eventIds = reservations.map((reservation) => reservation.triggerEventId);
    const runs = await this.prisma.run.findMany({
      where: { triggerEventId: { in: eventIds } },
      select: { triggerEventId: true, status: true },
    });
    const runByEventId = new Map(runs.map((run) => [run.triggerEventId, run.status]));

    await Promise.all(reservations.map(async ({ triggerEventId }) => {
      const status = runByEventId.get(triggerEventId);
      if (status === 'SENT') return this.settle(triggerEventId, true);
      if (status === 'SKIPPED' || status === 'FAILED' || status === undefined) {
        return this.settle(triggerEventId, false);
      }
      // PENDING and UNKNOWN may have crossed the provider boundary. Keep their
      // quota consumed until delivery is certain rather than refunding twice.
    }));
  }
}
