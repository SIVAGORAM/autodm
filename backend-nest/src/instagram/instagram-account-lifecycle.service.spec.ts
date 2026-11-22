import { ServiceUnavailableException } from '@nestjs/common';
import { InstagramAccountLifecycleService } from './instagram-account-lifecycle.service';

describe('InstagramAccountLifecycleService', () => {
  function setup() {
    const prisma: any = {
      igAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 'account-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'account-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      automation: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      metaDataDeletionRequest: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ confirmationCode: 'A'.repeat(32) }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      metaDeauthorizationReceipt: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const tx: any = {
      igAccount: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      automation: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'automation-1' }]),
      },
      dmQuotaReservation: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      webhookEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      metaDataDeletionRequest: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ confirmationCode: 'A'.repeat(32) }),
      },
      metaDeauthorizationReceipt: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
      },
    };
    prisma.$transaction = jest.fn((callback: (tx: any) => unknown) => callback(tx));
    const queue: any = { getJobs: jest.fn().mockResolvedValue([]) };
    return { prisma, tx, queue, service: new InstagramAccountLifecycleService(prisma, queue) };
  }

  it('pauses automations, removes pending account jobs, then erases the stored token', async () => {
    const { prisma, queue, service } = setup();
    const pendingJob = {
      data: { igAccountId: 'account-1' },
      remove: jest.fn().mockResolvedValue(undefined),
    };
    queue.getJobs
      .mockResolvedValueOnce([pendingJob])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(service.disconnect('owner-1', 'account-1')).resolves.toEqual({ success: true });

    expect(prisma.automation.updateMany).toHaveBeenCalledWith({
      where: { igAccountId: 'account-1' }, data: { status: 'PAUSED' },
    });
    expect(pendingJob.remove).toHaveBeenCalledTimes(1);
    expect(prisma.igAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'account-1', userId: 'owner-1' },
      data: { isActive: false, accessTokenEnc: '', tokenExpiresAt: null, webhookSubscribedAt: null, lastAlertAt: null },
    });
    expect(prisma.automation.updateMany.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.igAccount.updateMany.mock.invocationCallOrder[0]);
  });

  it('does not clear the token when the queue cannot be inspected', async () => {
    const { prisma, queue, service } = setup();
    queue.getJobs.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service.disconnect('owner-1', 'account-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.automation.updateMany).toHaveBeenCalledWith({
      where: { igAccountId: 'account-1' }, data: { status: 'PAUSED' },
    });
    expect(prisma.igAccount.updateMany).not.toHaveBeenCalled();
  });

  it('waits until active account jobs finish before clearing the token', async () => {
    const { prisma, queue, service } = setup();
    let activeChecks = 0;
    queue.getJobs.mockImplementation(async (states: string[]) => {
      if (!states.includes('active')) return [];
      activeChecks += 1;
      return activeChecks === 1 ? [{ data: { igAccountId: 'account-1' } }] : [];
    });

    await expect(service.disconnect('owner-1', 'account-1')).resolves.toEqual({ success: true });
    expect(activeChecks).toBe(2);
    expect(prisma.igAccount.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not inspect or modify another owner’s Instagram account', async () => {
    const { prisma, queue, service } = setup();
    prisma.igAccount.findFirst.mockResolvedValue(null);

    await expect(service.disconnect('owner-2', 'account-1')).rejects.toThrow('Account not found.');
    expect(queue.getJobs).not.toHaveBeenCalled();
    expect(prisma.automation.updateMany).not.toHaveBeenCalled();
    expect(prisma.igAccount.updateMany).not.toHaveBeenCalled();
  });

  it('purges account-owned data and creates an opaque idempotent completion receipt', async () => {
    const { prisma, tx, queue, service } = setup();

    const code = await service.deleteInstagramData('123456789', 'a'.repeat(64));

    expect(code).toBe('A'.repeat(32));
    expect(prisma.automation.updateMany).not.toHaveBeenCalled();
    expect(tx.automation.updateMany).toHaveBeenCalledWith({
      where: { igAccountId: 'account-1' }, data: { status: 'PAUSED' },
    });
    expect(tx.igAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'account-1', igUserId: '123456789' },
      data: { isActive: false, accessTokenEnc: '', tokenExpiresAt: null, webhookSubscribedAt: null, lastAlertAt: null },
    });
    expect(tx.igAccount.deleteMany).toHaveBeenCalledWith({ where: { igUserId: '123456789' } });
    expect(tx.dmQuotaReservation.deleteMany).toHaveBeenCalledWith({
      where: { automationId: { in: ['automation-1'] } },
    });
    expect(tx.webhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ igAccountId: 'account-1' }, { igUserId: '123456789' }] },
    });
    expect(tx.metaDataDeletionRequest.create).toHaveBeenCalledWith({
      data: { requestHash: 'a'.repeat(64), confirmationCode: expect.any(String) },
      select: { confirmationCode: true },
    });
    expect(queue.getJobs).toHaveBeenCalled();
  });

  it('returns the existing receipt when Meta retries a completed signed request', async () => {
    const { prisma, queue, service } = setup();
    prisma.metaDataDeletionRequest.findUnique.mockResolvedValue({ confirmationCode: 'B'.repeat(32) });

    await expect(service.deleteInstagramData('123456789', 'a'.repeat(64))).resolves.toBe('B'.repeat(32));
    expect(prisma.igAccount.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(queue.getJobs).not.toHaveBeenCalled();
  });

  it('keeps the deletion request retryable if the queue cannot be drained', async () => {
    const { prisma, tx, queue, service } = setup();
    queue.getJobs.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service.deleteInstagramData('123456789', 'a'.repeat(64))).rejects.toThrow('could not be fully purged');
    expect(tx.igAccount.updateMany).toHaveBeenCalled();
    expect(tx.igAccount.deleteMany).not.toHaveBeenCalled();
    expect(tx.metaDataDeletionRequest.create).not.toHaveBeenCalled();
  });

  it('reports deletion complete only for a matching opaque receipt code', async () => {
    const { prisma, service } = setup();
    prisma.metaDataDeletionRequest.findUnique.mockResolvedValueOnce({ createdAt: new Date() });
    await expect(service.metaDataDeletionStatus('A'.repeat(32))).resolves.toEqual({ status: 'completed' });
    prisma.metaDataDeletionRequest.findUnique.mockResolvedValueOnce(null);
    await expect(service.metaDataDeletionStatus('B'.repeat(32))).resolves.toEqual({ status: 'not_found' });
  });

  it('records Meta deauthorization idempotently before disabling the linked account', async () => {
    const { tx, service } = setup();

    await expect(service.deauthorizeInstagramUser('123456789', 'c'.repeat(64))).resolves.toEqual({ success: true });

    expect(tx.metaDeauthorizationReceipt.create).toHaveBeenCalledWith({ data: { requestHash: 'c'.repeat(64) } });
    expect(tx.automation.updateMany).toHaveBeenCalledWith({
      where: { igAccount: { igUserId: '123456789' } }, data: { status: 'PAUSED' },
    });
    expect(tx.igAccount.updateMany).toHaveBeenCalledWith({
      where: { igUserId: '123456789' },
      data: { isActive: false, accessTokenEnc: '', tokenExpiresAt: null, webhookSubscribedAt: null, lastAlertAt: null },
    });
  });

  it('does not reapply a previously processed Meta deauthorization', async () => {
    const { tx, service } = setup();
    tx.metaDeauthorizationReceipt.findUnique.mockResolvedValue({ id: 'receipt-1' });

    await expect(service.deauthorizeInstagramUser('123456789', 'c'.repeat(64))).resolves.toEqual({ success: true });
    expect(tx.metaDeauthorizationReceipt.create).not.toHaveBeenCalled();
    expect(tx.igAccount.updateMany).not.toHaveBeenCalled();
  });
});
