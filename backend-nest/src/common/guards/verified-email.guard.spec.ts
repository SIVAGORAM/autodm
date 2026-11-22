import { ForbiddenException } from '@nestjs/common';
import { VerifiedEmailGuard } from './verified-email.guard';
import { PRIVACY_VERSION, TERMS_VERSION } from '../../legal/policy-versions';

describe('VerifiedEmailGuard legal acceptance', () => {
  const context = { switchToHttp: () => ({ getRequest: () => ({ user: { userId: 'user-1' } }) }) } as any;
  const makeGuard = (user: any, status = 'DRAFT') => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    const config: any = { get: jest.fn((_key: string, fallback: unknown) => status ?? fallback) };
    return { guard: new VerifiedEmailGuard(prisma, config), prisma };
  };

  it('continues to require verified email', async () => {
    const { guard } = makeGuard({ isVerified: false, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
    await expect(guard.canActivate(context)).rejects.toThrow('Verify your email');
  });

  it('does not enforce draft policy versions', async () => {
    const { guard } = makeGuard({ isVerified: true, termsVersion: null, privacyVersion: null });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows current versions after approval', async () => {
    const { guard } = makeGuard({ isVerified: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }, 'APPROVED');
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('requires re-acceptance of outdated policies after approval', async () => {
    const { guard } = makeGuard({ isVerified: true, termsVersion: 'old', privacyVersion: 'old' }, 'APPROVED');
    await expect(guard.canActivate(context)).rejects.toThrow(new ForbiddenException('LEGAL_ACCEPTANCE_REQUIRED'));
  });
});
