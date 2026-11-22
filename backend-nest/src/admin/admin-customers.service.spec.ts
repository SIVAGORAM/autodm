import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminCustomersService } from './admin-customers.service';

describe('AdminCustomersService', () => {
  const baseCustomer: any = {
    id: 'customer-1', role: 'INFLUENCER', suspendedAt: null, suspensionReason: null,
    deletionRequestedAt: null, sessionVersion: 0,
  };
  const tx: any = {
    user: { findUnique: jest.fn(), updateMany: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    automation: { updateMany: jest.fn() },
    adminAuditEvent: { create: jest.fn() },
  };
  const prisma: any = {
    user: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn((value) => Array.isArray(value) ? Promise.all(value) : value(tx)),
  };
  const service = new AdminCustomersService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.user.findUnique.mockResolvedValue({ ...baseCustomer });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.refreshToken.deleteMany.mockResolvedValue({ count: 2 });
    tx.automation.updateMany.mockResolvedValue({ count: 3 });
    tx.adminAuditEvent.create.mockResolvedValue({ id: 'audit-1' });
  });

  it('paginates an allowlisted customer projection and aggregates only operational counts', async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([{
      ...baseCustomer, name: 'Creator', email: 'creator@example.test', plan: 'FREE', planExpiresAt: null,
      isVerified: true, createdAt: new Date(), suspensionReason: null, igAccounts: [
        { isActive: true, _count: { automations: 2 } }, { isActive: false, _count: { automations: 1 } },
      ],
    }]);
    const result = await service.list({ page: 1, pageSize: 25, status: 'ACTIVE' });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: 'INFLUENCER', suspendedAt: null, deletionRequestedAt: null },
      skip: 0, take: 25,
    }));
    expect(result.customers[0]).toMatchObject({ instagramAccountCount: 2, activeInstagramAccountCount: 1, automationCount: 3 });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('suspends a customer transactionally, invalidates sessions, pauses live automations, and audits the reason', async () => {
    const result = await service.suspend('admin-1', 'customer-1', 'Policy review requested');
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'customer-1', suspendedAt: null, deletionRequestedAt: null }),
      data: expect.objectContaining({ suspensionReason: 'Policy review requested', sessionVersion: { increment: 1 } }),
    }));
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'customer-1' } });
    expect(tx.automation.updateMany).toHaveBeenCalledWith({ where: { igAccount: { userId: 'customer-1' }, status: 'LIVE' }, data: { status: 'PAUSED' } });
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: 'admin-1', action: 'CUSTOMER_SUSPENDED', targetId: 'customer-1', reason: 'Policy review requested',
    }) }));
    expect(result).toMatchObject({ changed: true, status: 'SUSPENDED', pausedAutomations: 3 });
  });

  it('does not restart paused automations when reactivating a customer', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...baseCustomer, suspendedAt: new Date(), suspensionReason: 'Review' });
    const result = await service.reactivate('admin-1', 'customer-1', 'Review completed');
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { suspendedAt: null, suspensionReason: null, sessionVersion: { increment: 1 } } }));
    expect(tx.automation.updateMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ changed: true, status: 'ACTIVE', automationsRemainPaused: true });
  });

  it('refuses admin roles and accounts already under deletion from customer suspension', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...baseCustomer, role: 'ADMIN' });
    await expect(service.suspend('owner-1', 'customer-1', 'Security review')).rejects.toBeInstanceOf(NotFoundException);
    tx.user.findUnique.mockResolvedValueOnce({ ...baseCustomer, deletionRequestedAt: new Date() });
    await expect(service.suspend('owner-1', 'customer-1', 'Security review')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});
