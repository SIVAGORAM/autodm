import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard account deletion checks', () => {
  function setup(deletionRequestedAt: Date | null) {
    const request: any = { cookies: { access_token: 'access' }, headers: {} };
    const jwt: any = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', email: 'creator@example.test', role: 'INFLUENCER', sv: 0 }) };
    const config: any = { getOrThrow: jest.fn().mockReturnValue('secret') };
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ deletionRequestedAt, suspendedAt: null, sessionVersion: 0 }) } };
    const context: any = { switchToHttp: () => ({ getRequest: () => request }) };
    return { request, jwt, prisma, guard: new JwtAuthGuard(jwt, config, prisma), context };
  }

  it('allows a valid active user and populates the request principal', async () => {
    const { request, guard, context } = setup(null);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user-1', email: 'creator@example.test', role: 'INFLUENCER' });
  });

  it('rejects access immediately once account deletion is requested', async () => {
    const { request, guard, context } = setup(new Date());

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('rejects a valid token when its account no longer exists', async () => {
    const { guard, context, prisma } = setup(null);
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects active access tokens for a suspended customer', async () => {
    const { guard, context, prisma } = setup(null);
    prisma.user.findUnique.mockResolvedValue({ deletionRequestedAt: null, suspendedAt: new Date(), sessionVersion: 1 });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not reactivate an access token issued before suspension', async () => {
    const { guard, context, prisma } = setup(null);
    prisma.user.findUnique.mockResolvedValue({ deletionRequestedAt: null, suspendedAt: null, sessionVersion: 2 });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
