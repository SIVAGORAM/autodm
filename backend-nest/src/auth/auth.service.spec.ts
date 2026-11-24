import { createHmac } from 'crypto';
import bcrypt from 'bcryptjs';
import { AuthService, DUMMY_PASSWORD_HASH, hashRefreshToken } from './auth.service';
import { PRIVACY_VERSION, TERMS_VERSION } from '../legal/policy-versions';

describe('AuthService signup transaction', () => {
  it('creates the account, verification email, and refresh session in one transaction', async () => {
    const email = 'creator@example.test';
    const user = { id: 'user-1', name: 'Creator', email, role: 'INFLUENCER', plan: 'FREE', isVerified: false };
    const tx: any = {
      user: { create: jest.fn().mockResolvedValue(user) },
      mailOutbox: { create: jest.fn().mockResolvedValue({}) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((work: any) => work(tx)),
    };
    const jwt: any = { signAsync: jest.fn().mockResolvedValueOnce('access-jwt').mockResolvedValueOnce('refresh-jwt') };
    const config: any = { getOrThrow: jest.fn((key: string) => `${key}-test-secret`), get: jest.fn((_key: string, fallback: unknown) => fallback) };
    const mailOutbox: any = { queueVerification: jest.fn().mockResolvedValue(undefined) };
    const hash = jest.spyOn(bcrypt, 'hash').mockResolvedValue('password-hash' as never);

    try {
      const service = new AuthService(prisma, jwt, config, mailOutbox, {} as any);
      const result = await service.signup('Creator', email, 'StrongPass1!', TERMS_VERSION, PRIVACY_VERSION);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: expect.any(Date),
          privacyVersion: PRIVACY_VERSION,
          privacyAcknowledgedAt: expect.any(Date),
          ageConfirmedAt: expect.any(Date),
        }),
      }));
      expect(mailOutbox.queueVerification).toHaveBeenCalledWith(tx, user.id, email, expect.stringMatching(/^\d{6}$/), expect.any(Date));
      expect(tx.refreshToken.create).toHaveBeenCalledWith({
        data: { id: expect.any(String), tokenHash: hashRefreshToken('refresh-jwt'), userId: user.id, familyId: expect.any(String), expiresAt: expect.any(Date) },
      });
      expect(JSON.stringify(tx.refreshToken.create.mock.calls[0][0])).not.toContain('refresh-jwt');
      expect(result).toEqual(expect.objectContaining({ user, verificationEmailQueued: true, accessToken: 'access-jwt', refreshToken: 'refresh-jwt' }));
    } finally {
      hash.mockRestore();
    }
  });
});

describe('AuthService unknown-user timing resistance', () => {
  it('uses a valid cost-12 bcrypt hash for an unknown email', async () => {
    const compare = jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(service.login('missing@example.test', 'wrong-password')).rejects.toThrow('Invalid email or password');

    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(12);
    expect(compare).toHaveBeenCalledWith('wrong-password', DUMMY_PASSWORD_HASH);
    compare.mockRestore();
  });
});

describe('AuthService email verification trial', () => {
  it('starts the two-day trial when the email is verified', async () => {
    const secret = 'test-only-jwt-access-secret';
    const now = Date.now();
    const user = {
      id: 'user-1', email: 'creator@example.test', name: 'Creator', isVerified: false,
      otpCode: createHmac('sha256', secret).update('123456').digest('hex'),
      otpExpires: new Date(now + 60_000), otpAttempts: 0,
    };
    const tx: any = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      mailOutbox: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
      $transaction: jest.fn((work: any) => work(tx)),
    };
    const outbox: any = { queueWelcome: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(prisma, {} as any, { getOrThrow: () => secret } as any, outbox, {} as any);

    await service.verifyOtp(user.id, '123456');

    const update = tx.user.updateMany.mock.calls[0][0];
    const trialEndsAt = update.data.trialEndsAt as Date;
    expect(update.where.id).toBe(user.id);
    expect(update.data.isVerified).toBe(true);
    expect(trialEndsAt.getTime()).toBeGreaterThanOrEqual(now + 2 * 86400000 - 1000);
    expect(trialEndsAt.getTime()).toBeLessThanOrEqual(Date.now() + 2 * 86400000 + 1000);
    expect(outbox.queueWelcome).toHaveBeenCalledWith(expect.anything(), user.id, user.email, user.name, trialEndsAt);
  });
});

describe('AuthService verification email delivery status', () => {
  const serviceFor = (isVerified: boolean, message: any = null, otpExpires = new Date(Date.now() + 60_000)) => {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ isVerified, otpExpires }) },
      mailOutbox: { findUnique: jest.fn().mockResolvedValue(message) },
    };
    return { service: new AuthService(prisma, {} as any, {} as any, {} as any, {} as any), prisma };
  };

  it('reports only the authenticated user’s latest delivery state', async () => {
    const { service, prisma } = serviceFor(false, { status: 'PENDING', attempts: 2, expiresAt: new Date(Date.now() + 60_000) });

    await expect(service.verificationEmailStatus('user-1')).resolves.toEqual({ success: true, status: 'retrying' });
    expect(prisma.mailOutbox.findUnique).toHaveBeenCalledWith({
      where: { dedupeKey: expect.stringMatching(/^verification:user-1:\d+$/) },
      select: { status: true, attempts: true, expiresAt: true },
    });
  });

  it('does not expose queued message data when the provider accepted the message', async () => {
    const { service } = serviceFor(false, { status: 'SENT', attempts: 1, expiresAt: new Date() });

    await expect(service.verificationEmailStatus('user-1')).resolves.toEqual({ success: true, status: 'sent' });
  });

  it('reports verified accounts without looking up mail or distinguishes missing/expired messages safely', async () => {
    const verified = serviceFor(true);
    await expect(verified.service.verificationEmailStatus('user-1')).resolves.toEqual({ success: true, status: 'verified' });
    expect(verified.prisma.mailOutbox.findUnique).not.toHaveBeenCalled();

    const missing = serviceFor(false);
    await expect(missing.service.verificationEmailStatus('user-1')).resolves.toEqual({ success: true, status: 'not_queued' });

    const expired = serviceFor(false, null, new Date(Date.now() - 1000));
    await expect(expired.service.verificationEmailStatus('user-1')).resolves.toEqual({ success: true, status: 'expired' });
  });
});

describe('AuthService refresh rotation', () => {
  it('revokes the replayed family when the old refresh-token row is already gone', async () => {
    const prisma: any = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const familyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const jwt: any = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', jti: 'old-jti', fid: familyId }) };
    const service = new AuthService(
      prisma, jwt, { getOrThrow: () => 'secret' } as any, {} as any, {} as any,
    );

    await expect(service.refresh('old-token')).rejects.toThrow('Token reuse detected');
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', familyId } });
  });

  it('allows only one concurrent use and revokes only the replayed device session', async () => {
    const liveRows: any[] = [
      { id: 'old-jti', tokenHash: hashRefreshToken('old-token'), userId: 'user-1', familyId: 'family-a', expiresAt: new Date(Date.now() + 60_000) },
      { id: 'other-session', tokenHash: hashRefreshToken('other-token'), userId: 'user-1', familyId: 'family-b', expiresAt: new Date(Date.now() + 60_000) },
    ];
    const tx: any = {
      refreshToken: {
        deleteMany: jest.fn(async ({ where }: any) => {
          if (where.id) {
            const index = liveRows.findIndex((row) => row.id === where.id && row.tokenHash === where.tokenHash);
            if (index < 0) return { count: 0 };
            liveRows.splice(index, 1);
            return { count: 1 };
          }
          const matches = liveRows.filter((row) => row.userId === where.userId && row.familyId === where.familyId);
          for (const row of matches) liveRows.splice(liveRows.indexOf(row), 1);
          return { count: matches.length };
        }),
        create: jest.fn(async ({ data }: any) => { liveRows.push(data); return data; }),
      },
    };
    let signId = 0;
    const jwt: any = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', jti: 'old-jti', fid: 'family-a' }),
      signAsync: jest.fn(async () => `signed-${++signId}`),
    };
    const prisma: any = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'old-jti', tokenHash: hashRefreshToken('old-token'), userId: 'user-1', familyId: 'family-a', expiresAt: new Date(Date.now() + 60_000),
          user: { id: 'user-1', email: 'creator@example.test', role: 'INFLUENCER' },
        }),
      },
      $transaction: jest.fn((work: any) => work(tx)),
    };
    const service = new AuthService(prisma, jwt, { getOrThrow: () => 'secret', get: (_key: string, fallback: string) => fallback } as any, {} as any, {} as any);

    const results = await Promise.allSettled([service.refresh('old-token'), service.refresh('old-token')]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(tx.refreshToken.create).toHaveBeenCalledTimes(1);
    // The successor is revoked, but another browser/device stays signed in.
    expect(liveRows).toEqual([expect.objectContaining({ id: 'other-session', familyId: 'family-b' })]);
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', familyId: 'family-a' } });
  });

  it('commits password replacement and session revocation in one transaction', async () => {
    const token = 'a'.repeat(64);
    const tx: any = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma: any = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      $transaction: jest.fn((work: any) => work(tx)),
    };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(service.resetPassword(token, 'StrongPass1!')).resolves.toEqual({ success: true });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('only queues a password reset email if the user account exists (OWASP enumeration defense)', async () => {
    const tx: any = { user: { update: jest.fn().mockResolvedValue({}) } };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'user-1', email: 'valid@example.test' }) },
      $transaction: jest.fn((work: any) => work(tx)),
    };
    const mailOutbox: any = { queuePasswordReset: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(prisma, {} as any, {} as any, mailOutbox, {} as any);

    // 1. Unknown email: Returns generic success, but queues NO email
    const unknownRes = await service.requestPasswordReset('nonexistent@example.test');
    expect(unknownRes).toEqual({ success: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mailOutbox.queuePasswordReset).not.toHaveBeenCalled();

    // 2. Known email: Generates token and queues email
    const knownRes = await service.requestPasswordReset('valid@example.test');
    expect(knownRes).toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: expect.objectContaining({ passwordResetTokenHash: expect.any(String), passwordResetExpiresAt: expect.any(Date) }),
    }));
    expect(mailOutbox.queuePasswordReset).toHaveBeenCalledWith(
      tx, 'user-1', 'valid@example.test', expect.stringMatching(/^[a-f0-9]{64}$/), expect.any(Date),
    );
  });
});
