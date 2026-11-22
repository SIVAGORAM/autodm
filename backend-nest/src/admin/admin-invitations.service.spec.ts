import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AdminInvitationsService } from './admin-invitations.service';

describe('AdminInvitationsService', () => {
  const actorId = '8a13f474-aebc-45a4-a37e-c1df05847fb6';
  const userId = '2f1a33fc-2a1a-4caa-9f7a-a2c7f67f16c4';
  const invitationId = '4d24ffec-c717-42fd-a8cc-c7fe36cbf7e7';
  const tx: any = {
    adminInvitation: {
      updateMany: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
    },
    user: { findUnique: jest.fn(), updateMany: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    adminAuditEvent: { create: jest.fn() },
  };
  const prisma: any = {
    adminInvitation: { updateMany: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const outbox: any = { queueAdminInvitation: jest.fn().mockResolvedValue(undefined) };
  const service = new AdminInvitationsService(prisma, outbox);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.adminInvitation.updateMany.mockResolvedValue({ count: 1 });
    tx.adminInvitation.findFirst.mockResolvedValue(null);
    tx.adminInvitation.findUnique.mockResolvedValue(null);
    tx.adminInvitation.findMany.mockResolvedValue([]);
    tx.adminInvitation.create.mockImplementation(({ data }: any) => Promise.resolve({
      id: invitationId, email: data.email, permissions: data.permissions, createdAt: new Date(), expiresAt: data.expiresAt,
    }));
    tx.user.findUnique.mockResolvedValue(null);
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    tx.adminAuditEvent.create.mockResolvedValue({ id: 'audit-id' });
  });

  it('creates an audited one-use invitation and queues its token only in the encrypted mail outbox', async () => {
    const result = await service.create(actorId, {
      email: ' New-Admin@Example.Test ', permissions: ['CONTACT_MANAGE'], reason: 'Invite contact support staff',
    });
    expect(result).toMatchObject({ id: invitationId, email: 'new-admin@example.test', permissions: ['CONTACT_MANAGE'], emailQueued: true });
    expect(result).not.toHaveProperty('token');
    const createData = tx.adminInvitation.create.mock.calls[0][0].data;
    expect(createData).toMatchObject({ email: 'new-admin@example.test', invitedById: actorId, permissions: ['CONTACT_MANAGE'] });
    expect(createData.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const queued = outbox.queueAdminInvitation.mock.calls[0][1];
    expect(queued).toMatchObject({ invitationId, to: 'new-admin@example.test', expiresAt: expect.any(Date) });
    expect(createHash('sha256').update(queued.token).digest('hex')).toBe(createData.tokenHash);
    expect(queued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId, action: 'ADMIN_INVITATION_CREATED', targetId: invitationId, reason: 'Invite contact support staff',
    }) }));
  });

  it('does not create multiple active invitations for one email', async () => {
    tx.adminInvitation.findFirst.mockResolvedValueOnce({ id: invitationId, expiresAt: new Date(Date.now() + 60_000) });
    await expect(service.create(actorId, {
      email: 'new-admin@example.test', permissions: [], reason: 'Invite contact support staff',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.adminInvitation.create).not.toHaveBeenCalled();
    expect(outbox.queueAdminInvitation).not.toHaveBeenCalled();
  });

  it('revokes an active invitation with a reason and audit record', async () => {
    tx.adminInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId, email: 'new-admin@example.test', permissions: ['CONTACT_MANAGE'], acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.revoke(actorId, invitationId, 'The team role is no longer needed')).resolves.toEqual({ revoked: true });
    expect(tx.adminInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: invitationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { revokedAt: expect.any(Date) },
    }));
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'ADMIN_INVITATION_REVOKED', targetId: invitationId, reason: 'The team role is no longer needed',
    }) }));
  });

  it('requires a verified matching account and consumes the invitation atomically', async () => {
    const token = 'e'.repeat(43);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    tx.adminInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId, email: 'new-admin@example.test', permissions: ['CONTACT_MANAGE'], tokenHash,
      expiresAt: new Date(Date.now() + 60_000), acceptedAt: null, revokedAt: null,
    });
    tx.user.findUnique.mockResolvedValueOnce({
      id: userId, email: 'new-admin@example.test', role: 'INFLUENCER', isVerified: true,
      suspendedAt: null, deletionRequestedAt: null, sessionVersion: 4,
    });
    await expect(service.accept(userId, token)).resolves.toEqual({
      accepted: true, reauthenticationRequired: true, permissions: ['CONTACT_MANAGE'],
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: userId, role: 'INFLUENCER', isVerified: true, sessionVersion: 4 }),
      data: { role: 'ADMIN', adminPermissions: ['CONTACT_MANAGE'], sessionVersion: { increment: 1 } },
    }));
    expect(tx.adminInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: invitationId, tokenHash, acceptedAt: null, revokedAt: null }),
      data: { acceptedAt: expect.any(Date), acceptedById: userId },
    }));
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId } });
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: userId, action: 'ADMIN_INVITATION_ACCEPTED', targetId: invitationId,
    }) }));
  });

  it('does not consume an invitation for an account with a different email', async () => {
    const token = 'f'.repeat(43);
    tx.adminInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId, email: 'new-admin@example.test', permissions: [], expiresAt: new Date(Date.now() + 60_000), acceptedAt: null, revokedAt: null,
    });
    tx.user.findUnique.mockResolvedValueOnce({
      id: userId, email: 'other@example.test', role: 'INFLUENCER', isVerified: true, suspendedAt: null, deletionRequestedAt: null, sessionVersion: 1,
    });
    await expect(service.accept(userId, token)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.adminInvitation.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an already accepted or expired token without changing account access', async () => {
    const token = 'g'.repeat(43);
    tx.adminInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId, email: 'new-admin@example.test', permissions: [], expiresAt: new Date(Date.now() - 60_000), acceptedAt: null, revokedAt: null,
    });
    await expect(service.accept(userId, token)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('maps a concurrent acceptance serialization conflict to a retryable conflict', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('transaction conflict', {
      code: 'P2034', clientVersion: 'test',
    }));

    await expect(service.accept(userId, 'h'.repeat(43))).rejects.toMatchObject({
      constructor: ConflictException,
      message: 'This invitation changed during acceptance. Sign in again and check your administrator status.',
    });
  });

  it('maps a concurrent revocation serialization conflict to a retryable conflict', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('transaction conflict', {
      code: 'P2034', clientVersion: 'test',
    }));

    await expect(service.revoke(actorId, invitationId, 'The team role is no longer needed')).rejects.toMatchObject({
      constructor: ConflictException,
      message: 'This invitation changed during revocation. Refresh the team list and retry.',
    });
  });
});
