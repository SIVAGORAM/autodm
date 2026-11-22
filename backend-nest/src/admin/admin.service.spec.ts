import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const member = {
    id: 'target-id', name: 'Team Member', email: 'staff@example.test', role: 'INFLUENCER',
    adminPermissions: [],
    isVerified: true, deletionRequestedAt: null, suspendedAt: null, suspensionReason: null, sessionVersion: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const tx: any = {
    user: { findUnique: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    adminAuditEvent: { create: jest.fn() },
  };
  const prisma: any = {
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const service = new AdminService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.user.findUnique.mockResolvedValue({ ...member });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.count.mockResolvedValue(2);
    tx.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    tx.adminAuditEvent.create.mockResolvedValue({ id: 'audit-id' });
  });

  it('lists active and suspended administrators with only lifecycle metadata', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await service.listTeam();
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletionRequestedAt: null },
      select: { id: true, name: true, email: true, role: true, adminPermissions: true, isVerified: true, adminMfaEnabledAt: true, createdAt: true, suspendedAt: true },
    }));
  });

  it('promotes only an existing active verified account and writes an audit event atomically', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: member.id });
    const result = await service.addAdmin('owner-id', { email: ' staff@example.test ', reason: 'Support coverage for launch' });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'staff@example.test' }, select: { id: true } });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      role: 'ADMIN', adminPermissions: [],
      sessionVersion: { increment: 1 },
    }) }));
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: 'owner-id', action: 'ADMIN_ROLE_CHANGED', targetId: member.id,
      before: { role: 'INFLUENCER' }, after: { role: 'ADMIN' }, reason: 'Support coverage for launch',
    }) }));
    expect(result).toMatchObject({ changed: true, member: { role: 'ADMIN', email: member.email } });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('does not allow a super admin to change their own role', async () => {
    await expect(service.updateTeamRole('same-id', 'same-id', { role: 'INFLUENCER', reason: 'Leaving the admin team' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a verified, active target account', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, isVerified: false });
    await expect(service.updateTeamRole('owner-id', member.id, { role: 'ADMIN', reason: 'Support coverage for launch' }))
      .rejects.toThrow('Verify the account email');
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('will not remove the final active Super Admin', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'SUPER_ADMIN' });
    tx.user.count.mockResolvedValueOnce(1);
    await expect(service.updateTeamRole('owner-id', member.id, { role: 'INFLUENCER', reason: 'Access no longer needed' }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.count).toHaveBeenCalledWith({ where: { role: 'SUPER_ADMIN', deletionRequestedAt: null, suspendedAt: null } });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('promotes a standard admin to Super Admin, clears scoped grants, and revokes sessions', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'ADMIN', adminPermissions: ['CONTACT_MANAGE'] });
    await expect(service.updateTeamRole('owner-id', member.id, {
      role: 'SUPER_ADMIN', reason: 'Assign full operational ownership',
    })).resolves.toMatchObject({ changed: true, member: { role: 'SUPER_ADMIN', adminPermissions: [] } });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { role: 'SUPER_ADMIN', adminPermissions: [], sessionVersion: { increment: 1 } },
    }));
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: member.id } });
  });

  it('demotes a Super Admin to standard Admin with no default operational grants', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'SUPER_ADMIN' });
    await expect(service.updateTeamRole('owner-id', member.id, {
      role: 'ADMIN', reason: 'Reduce privileged access for daily support',
    })).resolves.toMatchObject({ changed: true, member: { role: 'ADMIN', adminPermissions: [] } });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: 'ADMIN', adminPermissions: [] }),
    }));
  });

  it('revokes refresh sessions when removing admin privileges', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'ADMIN' });
    await service.updateTeamRole('owner-id', member.id, { role: 'INFLUENCER', reason: 'Access no longer needed' });
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: member.id } });
  });

  it('resets MFA with session revocation and a reasoned audit record', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'ADMIN', adminMfaEnabledAt: new Date() });
    await expect(service.resetAdminMfa('owner-id', member.id, 'Administrator lost their authenticator device'))
      .resolves.toMatchObject({ changed: true, mfaSetupRequired: true, sessionsRevoked: true });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      adminMfaEnabledAt: null, adminMfaSecretEnc: null, adminMfaRecoveryCodeHashes: [], sessionVersion: { increment: 1 },
    }) }));
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: member.id } });
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: 'owner-id', action: 'ADMIN_MFA_RESET', targetId: member.id, reason: 'Administrator lost their authenticator device',
    }) }));
  });

  it('does not reveal an absent account through an unrestricted user search', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.addAdmin('owner-id', { email: 'missing@example.test', reason: 'Support coverage for launch' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates only a verified active standard admin permission set and audits before/after values', async () => {
    const current = ['MAIL_READ', 'OPERATIONS_READ'];
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'ADMIN', adminPermissions: current });
    await expect(service.updateAdminPermissions('owner-id', member.id, {
      permissions: ['SUPPORT_MANAGE', 'CONTACT_MANAGE'], reason: 'Limit account to customer support duties',
    })).resolves.toMatchObject({ changed: true, permissions: ['CONTACT_MANAGE', 'SUPPORT_MANAGE'] });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: 'ADMIN', adminPermissions: { equals: current } }),
      data: { adminPermissions: ['CONTACT_MANAGE', 'SUPPORT_MANAGE'] },
    }));
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: 'owner-id', action: 'ADMIN_PERMISSIONS_CHANGED', targetId: member.id,
      before: { permissions: current }, after: { permissions: ['CONTACT_MANAGE', 'SUPPORT_MANAGE'] },
    }) }));
  });

  it('does not permit custom permissions to be attached to a Super Admin', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'SUPER_ADMIN' });
    await expect(service.updateAdminPermissions('owner-id', member.id, {
      permissions: [], reason: 'Restore full Super Admin access',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('suspends another admin, revokes sessions, clears pending MFA challenge, and audits the reason', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'ADMIN' });
    await expect(service.suspendAdmin('owner-id', member.id, 'Security review requires temporary access hold'))
      .resolves.toMatchObject({ changed: true, status: 'SUSPENDED', sessionsRevoked: true });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: member.id, role: 'ADMIN', suspendedAt: null }),
      data: expect.objectContaining({
        suspendedAt: expect.any(Date), suspensionReason: 'Security review requires temporary access hold',
        sessionVersion: { increment: 1 }, adminMfaChallengeHash: null, adminMfaPendingSecretEnc: null,
      }),
    }));
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: member.id } });
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: 'owner-id', action: 'ADMIN_SUSPENDED', targetId: member.id,
      reason: 'Security review requires temporary access hold',
    }) }));
  });

  it('prevents suspending the last active Super Admin', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'SUPER_ADMIN' });
    tx.user.count.mockResolvedValueOnce(1);
    await expect(service.suspendAdmin('owner-id', member.id, 'Security review requires temporary access hold'))
      .rejects.toThrow('At least one active Super Admin must remain');
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('reactivates a suspended admin with a reason and requires fresh authentication', async () => {
    tx.user.findUnique.mockResolvedValueOnce({ ...member, role: 'ADMIN', suspendedAt: new Date('2026-02-01T00:00:00Z') });
    await expect(service.reactivateAdmin('owner-id', member.id, 'Security review is completed and access approved'))
      .resolves.toMatchObject({ changed: true, status: 'ACTIVE', sessionsRevoked: true });
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: member.id, role: 'ADMIN', suspendedAt: { not: null } }),
      data: { suspendedAt: null, suspensionReason: null, sessionVersion: { increment: 1 } },
    }));
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: member.id } });
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'ADMIN_REACTIVATED', reason: 'Security review is completed and access approved',
    }) }));
  });
});
