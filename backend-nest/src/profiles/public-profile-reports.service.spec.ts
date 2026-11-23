import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PublicProfileReportsService } from './public-profile-reports.service';

function fixtures() {
  const tx = {
    publicProfileReport: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'report-1', status: 'ACTIONED', moderationNote: 'Confirmed impersonation', reviewedAt: new Date() }),
    },
    publicProfile: {
      findUnique: jest.fn().mockResolvedValue({ visibility: 'PUBLIC' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    adminAuditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    profileHandle: { findFirst: jest.fn() },
    publicProfileReport: {
      create: jest.fn().mockResolvedValue({ id: 'report-1' }),
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([{ id: 'report-1' }]),
    },
    $transaction: jest.fn(async (arg: unknown, options?: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      return (arg as (value: typeof tx) => Promise<unknown>)(tx);
    }),
  };
  const service = new PublicProfileReportsService(prisma as never);
  return { service, prisma, tx };
}

const visibleCreator = {
  id: 'profile-1', displayName: 'Creator', visibility: 'PUBLIC',
  user: { role: 'INFLUENCER', suspendedAt: null, deletionRequestedAt: null },
};

describe('PublicProfileReportsService', () => {
  it('creates a report only against a visible active profile and stores no reporter identity', async () => {
    const { service, prisma } = fixtures();
    prisma.profileHandle.findFirst.mockResolvedValue({ username: 'creator', profile: visibleCreator });

    await expect(service.create('Creator', { reason: 'SCAM', details: 'Fake offer page' })).resolves.toEqual({ received: true });
    expect(prisma.profileHandle.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { username: { equals: 'creator', mode: 'insensitive' }, isCurrent: true },
    }));
    expect(prisma.publicProfileReport.create).toHaveBeenCalledWith({ data: {
      profileId: 'profile-1', reportedUsername: 'creator', reportedDisplayName: 'Creator', reason: 'SCAM', details: 'Fake offer page',
    }, select: { id: true } });
  });

  it('does not reveal private, inactive, deleted, or nonexistent profiles through reports', async () => {
    const { service, prisma } = fixtures();
    prisma.profileHandle.findFirst.mockResolvedValue({ username: 'creator', profile: { ...visibleCreator, visibility: 'PRIVATE' } });
    await expect(service.create('creator', { reason: 'OTHER', details: undefined })).rejects.toBeInstanceOf(NotFoundException);
    prisma.profileHandle.findFirst.mockResolvedValue(null);
    await expect(service.create('missing', { reason: 'OTHER', details: undefined })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.publicProfileReport.create).not.toHaveBeenCalled();
  });

  it('hides an actioned profile and writes an audit event in the same transaction', async () => {
    const { service, prisma, tx } = fixtures();
    tx.publicProfileReport.findUnique.mockResolvedValue({ id: 'report-1', profileId: 'profile-1', status: 'OPEN', reason: 'IMPERSONATION', reportedUsername: 'creator' });

    await service.review('report-1', 'admin-1', { status: 'ACTIONED', moderationNote: 'Confirmed impersonation' });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(tx.publicProfile.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'profile-1' },
      data: expect.objectContaining({ visibility: 'PRIVATE', moderationBlockedAt: expect.any(Date) }),
    }));
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: 'admin-1', action: 'PUBLIC_PROFILE_REPORT_REVIEWED', targetType: 'PublicProfileReport', targetId: 'report-1',
    }) }));
  });

  it('paginates the moderation queue without selecting reporter or profile-owner contact data', async () => {
    const { service, prisma } = fixtures();
    await expect(service.list(2, 'OPEN' as never)).resolves.toMatchObject({ page: 2, pageSize: 25, total: 1, hasMore: false });
    expect(prisma.publicProfileReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 25, take: 25,
      select: expect.not.objectContaining({ reporterEmail: true, reporterIp: true, user: expect.anything() }),
    }));
  });

  it('does not hide profiles when a report is dismissed and rejects terminal state changes', async () => {
    const { service, tx } = fixtures();
    tx.publicProfileReport.findUnique.mockResolvedValueOnce({ id: 'report-1', profileId: 'profile-1', status: 'OPEN', reason: 'SPAM' });
    tx.publicProfileReport.update.mockResolvedValueOnce({ id: 'report-1', status: 'DISMISSED' });
    await service.review('report-1', 'admin-1', { status: 'DISMISSED', moderationNote: 'No policy violation' });
    expect(tx.publicProfile.updateMany).not.toHaveBeenCalled();

    tx.publicProfileReport.findUnique.mockResolvedValueOnce({ id: 'report-1', profileId: 'profile-1', status: 'DISMISSED', reason: 'SPAM' });
    await expect(service.review('report-1', 'admin-1', { status: 'ACTIONED', moderationNote: 'Confirmed violation' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('restores an eligible restricted profile and records a separate audit action', async () => {
    const { service, tx } = fixtures();
    tx.publicProfileReport.findUnique.mockResolvedValue({ id: 'report-1', profileId: 'profile-1', status: 'ACTIONED', reportedUsername: 'creator' });
    tx.publicProfile.findUnique.mockResolvedValue({
      visibility: 'PRIVATE', moderationBlockedAt: new Date(), user: { role: 'INFLUENCER', suspendedAt: null, deletionRequestedAt: null },
    });
    tx.publicProfile.update.mockResolvedValue({});
    await expect(service.restore('report-1', 'admin-1', 'False positive confirmed')).resolves.toEqual({ id: 'report-1', profileVisibility: 'PUBLIC' });
    expect(tx.publicProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' }, data: { visibility: 'PUBLIC', moderationBlockedAt: null },
    });
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'PUBLIC_PROFILE_RESTRICTION_RESTORED', actorId: 'admin-1', reason: 'False positive confirmed',
    }) }));
  });
});
