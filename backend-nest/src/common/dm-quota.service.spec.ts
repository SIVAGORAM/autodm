import { DmQuotaReservationStatus } from '@prisma/client';
import { DmQuotaService } from './dm-quota.service';

describe('DmQuotaService', () => {
  function setup(reservation: unknown = null, monthlyCounts = [1, 1], dailyCounts = [1, 1]) {
    const tx: any = {
      dmQuotaReservation: {
        findUnique: jest.fn().mockResolvedValue(reservation),
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      automation: {
        findUnique: jest.fn().mockResolvedValue({ dailyCountResetAt: new Date(Date.now() + 86_400_000) }),
        updateMany: jest.fn().mockImplementation(async () => ({ count: dailyCounts.shift() ?? 1 })),
      },
      user: { updateMany: jest.fn().mockImplementation(async () => ({ count: monthlyCounts.shift() ?? 1 })) },
    };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ plan: 'FREE', planExpiresAt: null, trialEndsAt: null }) },
      $transaction: jest.fn((work: any) => work(tx)),
    };
    return { tx, prisma, service: new DmQuotaService(prisma) };
  }

  it('reuses the original reservation without incrementing either counter again', async () => {
    const { tx, service } = setup({ triggerEventId: 'event-1' });

    await expect(service.consume('user-1', 'automation-1', 20, 'event-1')).resolves.toBe(true);

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.automation.updateMany).not.toHaveBeenCalled();
    expect(tx.dmQuotaReservation.create).not.toHaveBeenCalled();
  });

  it('does not reactivate a reservation after it has been released', async () => {
    const { tx, service } = setup({ status: DmQuotaReservationStatus.RELEASED });

    await expect(service.consume('user-1', 'automation-1', 20, 'event-1')).resolves.toBe(false);

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.automation.updateMany).not.toHaveBeenCalled();
    expect(tx.dmQuotaReservation.create).not.toHaveBeenCalled();
  });

  it('creates one reservation when both user and automation quotas allow the DM', async () => {
    const { tx, service } = setup();

    await expect(service.consume('user-1', 'automation-1', 20, 'event-1')).resolves.toBe(true);

    expect(tx.dmQuotaReservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        triggerEventId: 'event-1', userId: 'user-1', automationId: 'automation-1',
        status: DmQuotaReservationStatus.RESERVED,
        monthWindowEndsAt: expect.any(Date), dayWindowEndsAt: expect.any(Date),
      }),
    });
  });

  it('fails closed when either quota is exhausted', async () => {
    const { tx, service } = setup(null, [1, 0], [1, 1]);

    await expect(service.consume('user-1', 'automation-1', 20, 'event-1')).resolves.toBe(false);

    expect(tx.dmQuotaReservation.create).not.toHaveBeenCalled();
  });

  it('refunds monthly and daily counters for a definite no-send exactly once', async () => {
    const monthWindowEndsAt = new Date('2026-12-01T00:00:00.000Z');
    const dayWindowEndsAt = new Date('2026-11-22T00:00:00.000Z');
    const tx: any = {
      dmQuotaReservation: {
        findUnique: jest.fn().mockResolvedValue({
          status: DmQuotaReservationStatus.RESERVED, userId: 'user-1', automationId: 'automation-1',
          monthWindowEndsAt, dayWindowEndsAt,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      automation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma: any = { $transaction: jest.fn((work: any) => work(tx)) };
    const service = new DmQuotaService(prisma);

    await service.settle('event-1', false);

    expect(tx.dmQuotaReservation.updateMany).toHaveBeenCalledWith({
      where: { triggerEventId: 'event-1', status: DmQuotaReservationStatus.RESERVED },
      data: { status: DmQuotaReservationStatus.RELEASED, settledAt: expect.any(Date) },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', dmCountResetAt: monthWindowEndsAt, dmCount: { gt: 0 } },
      data: { dmCount: { decrement: 1 } },
    });
    expect(tx.automation.updateMany).toHaveBeenCalledWith({
      where: { id: 'automation-1', dailyCountResetAt: dayWindowEndsAt, dailyCount: { gt: 0 } },
      data: { dailyCount: { decrement: 1 } },
    });
  });

  it('does not decrement counters after a reservation window has rolled over', async () => {
    const tx: any = {
      dmQuotaReservation: {
        findUnique: jest.fn().mockResolvedValue({
          status: DmQuotaReservationStatus.RESERVED, userId: 'user-1', automationId: 'automation-1',
          monthWindowEndsAt: null, dayWindowEndsAt: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { updateMany: jest.fn() },
      automation: { updateMany: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((work: any) => work(tx)) };
    const service = new DmQuotaService(prisma);

    await service.settle('event-1', true);

    expect(tx.dmQuotaReservation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: DmQuotaReservationStatus.CONSUMED, settledAt: expect.any(Date) },
    }));
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.automation.updateMany).not.toHaveBeenCalled();
  });

  it('reconciles orphaned automation reservations without refunding sent or ambiguous runs', async () => {
    const prisma: any = {
      dmQuotaReservation: {
        findMany: jest.fn().mockResolvedValue([
          { triggerEventId: 'never-started' },
          { triggerEventId: 'sent' },
          { triggerEventId: 'failed' },
          { triggerEventId: 'pending' },
          { triggerEventId: 'unknown' },
        ]),
      },
      run: {
        findMany: jest.fn().mockResolvedValue([
          { triggerEventId: 'sent', status: 'SENT' },
          { triggerEventId: 'failed', status: 'FAILED' },
          { triggerEventId: 'pending', status: 'PENDING' },
          { triggerEventId: 'unknown', status: 'UNKNOWN' },
        ]),
      },
    };
    const service = new DmQuotaService(prisma);
    const settle = jest.spyOn(service, 'settle').mockResolvedValue(undefined);

    await service.settleUnstartedForAutomation('automation-1');

    expect(prisma.dmQuotaReservation.findMany).toHaveBeenCalledWith({
      where: { automationId: 'automation-1', status: DmQuotaReservationStatus.RESERVED },
      select: { triggerEventId: true },
    });
    expect(settle.mock.calls).toEqual([
      ['never-started', false],
      ['sent', true],
      ['failed', false],
    ]);
  });
});
