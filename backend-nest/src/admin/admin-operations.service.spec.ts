import { AdminOperationsService } from './admin-operations.service';

describe('AdminOperationsService', () => {
  function setup() {
    const values = [12, 10, 1, 1, 2, 1, 8, 7, 4, 3, 2, 4, 1, 1];
    const prisma: any = {
      user: { count: jest.fn().mockImplementation(() => Promise.resolve(values.shift())) },
      igAccount: { count: jest.fn().mockImplementation(() => Promise.resolve(values.shift())) },
      automation: { count: jest.fn().mockImplementation(() => Promise.resolve(values.shift())) },
      run: { count: jest.fn().mockImplementation(() => Promise.resolve(values.shift())) },
      supportRequest: { count: jest.fn().mockImplementation(() => Promise.resolve(values.shift())) },
      contactEnquiry: { count: jest.fn().mockImplementation(() => Promise.resolve(values.shift())) },
      mailOutbox: { count: jest.fn().mockImplementation(() => Promise.resolve(values.shift())) },
      webhookEvent: { count: jest.fn().mockImplementation(() => Promise.resolve(values.shift())) },
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      adminAuditEvent: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([{ id: 'audit-1' }]) },
      payment: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([{ id: 'payment-1', amount: 29900, currency: 'INR' }]),
        groupBy: jest.fn().mockResolvedValue([{ currency: 'INR', _count: { _all: 2 }, _sum: { amount: 59800 } }]),
      },
      $transaction: jest.fn((operations) => Promise.all(operations)),
    };
    const redis = { get: jest.fn().mockResolvedValue(String(Date.now())) };
    const queue: any = { client: redis, getJobCounts: jest.fn().mockResolvedValue({ waiting: 2, active: 1, delayed: 0, failed: 3 }) };
    return { prisma, queue, service: new AdminOperationsService(prisma, queue) };
  }

  it('reports real aggregate metrics and a worker heartbeat based on the queue', async () => {
    const { service } = setup();
    const result = await service.overview();
    expect(result.metrics).toEqual({
      customers: 12, activeCustomers: 10, suspendedCustomers: 1, deletionRequests: 1, adminAccounts: 2, mfaPendingAdmins: 1,
      instagramAccounts: 8, activeInstagramAccounts: 7, liveAutomations: 4, failedRuns: 3,
      openSupport: 2, newEnquiries: 4, failedMail: 1, deadLetters: 1,
    });
    expect(result.services).toEqual({ database: 'healthy', queue: 'healthy', worker: 'healthy' });
    expect(result.queue).toMatchObject({ waiting: 2, active: 1, failed: 3 });
  });

  it('marks unavailable queue and worker checks as unknown instead of healthy', async () => {
    const { queue, service } = setup();
    queue.getJobCounts.mockRejectedValue(new Error('Redis unavailable'));
    const result = await service.overview();
    expect(result.services.queue).toBe('unknown');
    expect(result.services.worker).toBe('unknown');
    expect(result.queue).toBeNull();
  });

  it('returns a paginated audit projection without before/after snapshots', async () => {
    const { prisma, service } = setup();
    const result = await service.auditEvents(2, 10, 'CUSTOMER');
    expect(result).toEqual({ page: 2, pageSize: 10, total: 1, events: [{ id: 'audit-1' }], hasMore: false });
    expect(prisma.adminAuditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10, take: 10,
      select: expect.objectContaining({ actor: { select: { id: true, name: true, email: true } } }),
    }));
  });

  it('returns provider-verified payment records and totals grouped by currency', async () => {
    const { prisma, service } = setup();
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-31T23:59:59.999Z');
    const result = await service.paymentLedger({
      page: 1, pageSize: 25, search: 'creator@example.com', plan: 'CREATOR', currency: 'INR', from, to,
    });
    expect(result).toMatchObject({
      page: 1, pageSize: 25, total: 2, hasMore: false,
      payments: [{ id: 'payment-1' }],
      recordedCaptures: [{ currency: 'INR', count: 2, amountMinorUnits: 59800 }],
    });
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 0, take: 25,
      where: expect.objectContaining({
        plan: 'CREATOR', currency: 'INR', createdAt: { gte: from, lte: to },
        OR: expect.arrayContaining([
          { orderId: { contains: 'creator@example.com', mode: 'insensitive' } },
          { user: { is: { email: { contains: 'creator@example.com', mode: 'insensitive' } } } },
        ]),
      }),
    }));
    expect(result.limitations).toContain('Refunds, reversals, failed-payment events, and subscription history are not stored in this ledger.');
  });
});
