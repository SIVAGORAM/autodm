import bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

describe('self-service account deletion', () => {
  const password = 'StrongPass1!';

  it('requires both the current password and the account email', async () => {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'creator@example.test', passwordHash: await bcrypt.hash(password, 4), deletionRequestedAt: null }) },
      $transaction: jest.fn(),
    };
    const service = new UsersService(prisma);

    await expect(service.requestAccountDeletion('user-1', password, 'wrong@example.test')).rejects.toThrow('Enter your account email');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await expect(service.requestAccountDeletion('user-1', 'wrong-password', 'creator@example.test')).rejects.toThrow('Current password is incorrect');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('immediately revokes sessions and disables connected automation after confirmation', async () => {
    const tx: any = {
      publicProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      profileAssetDeletion: { upsert: jest.fn() },
      user: { update: jest.fn() },
      refreshToken: { deleteMany: jest.fn() },
      igAccount: { updateMany: jest.fn() },
      automation: { updateMany: jest.fn() },
    };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', email: 'creator@example.test', passwordHash: await bcrypt.hash(password, 4), deletionRequestedAt: null }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new UsersService(prisma);

    const result = await service.requestAccountDeletion('user-1', password, ' Creator@Example.Test ');

    expect(result.scheduledFor.getTime() - result.requestedAt.getTime()).toBe(15 * 60_000);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        deletionRequestedAt: result.requestedAt,
        email: 'deleted-user-1@account.invalid',
        name: 'Deleted account',
        isVerified: false,
        plan: 'FREE',
        passwordResetTokenHash: null,
      }),
    });
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(tx.igAccount.updateMany).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { isActive: false, accessTokenEnc: '' } });
    expect(tx.automation.updateMany).toHaveBeenCalledWith({ where: { igAccount: { userId: 'user-1' } }, data: { status: 'PAUSED' } });
  });

  it('tombstones and locks expired unverified accounts before the normal queue-drain deletion', async () => {
    const now = new Date('2026-11-21T12:00:00Z');
    const accountId = 'unverified-user-1';
    const tx: any = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      refreshToken: { deleteMany: jest.fn() },
      igAccount: { updateMany: jest.fn() },
      automation: { updateMany: jest.fn() },
    };
    const prisma: any = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: accountId }]) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const config: any = { get: jest.fn((_key: string, fallback: number) => fallback) };
    const service = new UsersService(prisma, undefined, config);

    await expect(service.scheduleExpiredUnverifiedAccountDeletions(now)).resolves.toBe(1);

    const createdBefore = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isVerified: false, role: { notIn: ['ADMIN', 'SUPER_ADMIN'] }, deletionRequestedAt: null, createdAt: { lte: createdBefore } },
      select: { id: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 50,
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: accountId, isVerified: false, role: { not: 'ADMIN' }, deletionRequestedAt: null, createdAt: { lte: createdBefore } },
      data: expect.objectContaining({
        deletionRequestedAt: now,
        email: `deleted-${accountId}@account.invalid`,
        name: 'Deleted account',
        otpCode: null,
        passwordResetTokenHash: null,
      }),
    }));
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: accountId } });
    expect(tx.igAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: accountId }, data: expect.objectContaining({ isActive: false, accessTokenEnc: '' }) }));
    expect(tx.automation.updateMany).toHaveBeenCalledWith({ where: { igAccount: { userId: accountId } }, data: { status: 'PAUSED' } });
  });

  it('does not modify a user who verifies concurrently with the retention sweep', async () => {
    const tx: any = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      refreshToken: { deleteMany: jest.fn() },
      igAccount: { updateMany: jest.fn() },
      automation: { updateMany: jest.fn() },
    };
    const prisma: any = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'unverified-user-1' }]) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new UsersService(prisma, undefined, { get: (_key: string, fallback: number) => fallback } as any);

    await expect(service.scheduleExpiredUnverifiedAccountDeletions(new Date('2026-11-21T12:00:00Z'))).resolves.toBe(0);
    expect(tx.refreshToken.deleteMany).not.toHaveBeenCalled();
    expect(tx.igAccount.updateMany).not.toHaveBeenCalled();
    expect(tx.automation.updateMany).not.toHaveBeenCalled();
  });

  it('waits for active jobs, then removes deterministic queue jobs and anonymizes transaction ownership', async () => {
    const jobIds: string[] = [];
    const queueJob: any = { getState: jest.fn().mockResolvedValue('delayed'), remove: jest.fn().mockResolvedValue(undefined) };
    const queue: any = {
      getJobs: jest.fn().mockResolvedValue([]),
      getJob: jest.fn(async (id: string) => { jobIds.push(id); return queueJob; }),
    };
    const tx: any = {
      payment: { updateMany: jest.fn() },
      dmQuotaReservation: { deleteMany: jest.fn() },
      webhookEvent: { deleteMany: jest.fn() },
      user: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma: any = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'user-1', igAccounts: [{ id: 'account-1', igUserId: 'instagram-user-1' }] }]) },
      webhookEvent: { findMany: jest.fn().mockResolvedValue([{ id: 'webhook-1', eventId: 'comment:event-1' }]) },
      run: { findMany: jest.fn().mockResolvedValue([{ triggerEventId: 'comment:event-2', status: 'SENT' }]) },
      followUp: { findMany: jest.fn().mockResolvedValue([{ id: 'follow-up-1' }]) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new UsersService(prisma, queue);

    await expect(service.processPendingAccountDeletions(new Date('2026-11-21T12:00:00Z'))).resolves.toBe(1);

    expect(jobIds).toEqual(expect.arrayContaining([
      expect.stringMatching(/^wh-[a-f0-9]{64}$/),
      'comment:event-2',
      'comment:event-2:fu:follow-up-1',
    ]));
    expect(tx.payment.updateMany).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { userId: null } });
    expect(tx.dmQuotaReservation.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(prisma.webhookEvent.findMany).toHaveBeenCalledWith({
      where: { OR: [{ igAccountId: { in: ['account-1'] } }, { igUserId: { in: ['instagram-user-1'] } }] },
      select: { id: true, eventId: true },
    });
    expect(tx.webhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ igAccountId: { in: ['account-1'] } }, { igUserId: { in: ['instagram-user-1'] } }] },
    });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({ where: { id: 'user-1', deletionRequestedAt: { lte: new Date('2026-11-21T11:45:00Z') } } });
  });

  it('does not delete while an account send is active', async () => {
    const queue: any = { getJobs: jest.fn().mockResolvedValue([{ name: 'send', data: { igAccountId: 'account-1' } }]), getJob: jest.fn() };
    const prisma: any = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'user-1', igAccounts: [{ id: 'account-1' }] }]) },
      webhookEvent: { findMany: jest.fn().mockResolvedValue([]) },
      run: { findMany: jest.fn().mockResolvedValue([]) },
      followUp: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };
    const service = new UsersService(prisma, queue);

    await expect(service.processPendingAccountDeletions()).resolves.toBe(0);
    expect(queue.getJob).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
