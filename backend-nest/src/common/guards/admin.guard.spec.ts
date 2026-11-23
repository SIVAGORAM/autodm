import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const prisma: any = { user: { findUnique: jest.fn() } };
  const context: any = {
    switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'user-1', role: 'ADMIN' } }) }),
    getHandler: () => 'handler', getClass: () => 'class',
  };
  const reflector: any = { getAllAndOverride: jest.fn().mockReturnValue('SUPPORT_MANAGE') };
  const guard = new AdminGuard(prisma, reflector);

  beforeEach(() => jest.clearAllMocks());

  it('uses the current persisted role rather than the JWT role claim', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'INFLUENCER', deletionRequestedAt: null });

    await expect(guard.canActivate(context)).rejects.toThrow('Administrator access required.');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' }, select: { role: true, deletionRequestedAt: true, suspendedAt: true, adminMfaEnabledAt: true, adminPermissions: true },
    });
  });

  it('rejects a deletion-locked admin account', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', deletionRequestedAt: new Date() });
    await expect(guard.canActivate(context)).rejects.toThrow('Administrator access required.');
  });

  it('rejects an admin suspended between authentication and authorization checks', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', deletionRequestedAt: null, suspendedAt: new Date() });
    await expect(guard.canActivate(context)).rejects.toThrow('Administrator access required.');
  });

  it('allows an active persisted admin account', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', deletionRequestedAt: null, adminMfaEnabledAt: new Date(), adminPermissions: ['SUPPORT_MANAGE'] });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows an active persisted super admin on ordinary admin operations', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', deletionRequestedAt: null, adminMfaEnabledAt: new Date(), adminPermissions: [] });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects administrator APIs until MFA has been enrolled', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', deletionRequestedAt: null, adminMfaEnabledAt: null, adminPermissions: [] });
    await expect(guard.canActivate(context)).rejects.toThrow('Administrator MFA setup is required.');
  });

  it('denies an admin whose persisted permissions do not include the endpoint permission', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', deletionRequestedAt: null, adminMfaEnabledAt: new Date(), adminPermissions: ['MAIL_READ'] });
    reflector.getAllAndOverride.mockReturnValue('SUPPORT_MANAGE');
    await expect(guard.canActivate(context)).rejects.toThrow('Administrator permission required.');
  });

  it('fails closed when an admin endpoint has no declared permission', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', deletionRequestedAt: null, adminMfaEnabledAt: new Date(), adminPermissions: ['SUPPORT_MANAGE'] });
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow('Administrator permission is not configured for this operation.');
  });
});
