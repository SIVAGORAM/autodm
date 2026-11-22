import { SuperAdminGuard } from './super-admin.guard';

describe('SuperAdminGuard', () => {
  const prisma: any = { user: { findUnique: jest.fn() } };
  const context: any = { switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'user-1', role: 'SUPER_ADMIN' } }) }) };
  const guard = new SuperAdminGuard(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('rejects an ordinary admin even when the JWT role is privileged', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN', deletionRequestedAt: null });
    await expect(guard.canActivate(context)).rejects.toThrow('Super administrator access required.');
  });

  it('rejects a deletion-locked super admin', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', deletionRequestedAt: new Date() });
    await expect(guard.canActivate(context)).rejects.toThrow('Super administrator access required.');
  });

  it('allows an active persisted super admin', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', deletionRequestedAt: null, adminMfaEnabledAt: new Date() });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects super-admin APIs until MFA has been enrolled', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN', deletionRequestedAt: null, adminMfaEnabledAt: null });
    await expect(guard.canActivate(context)).rejects.toThrow('Administrator MFA setup is required.');
  });
});
