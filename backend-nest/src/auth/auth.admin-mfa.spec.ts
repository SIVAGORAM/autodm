import { createHmac } from 'node:crypto';
import { AuthService, hashRefreshToken } from './auth.service';
import { recoveryCodeHash } from './admin-mfa';

function totpAt(secret: string, step: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0; let acc = 0; const bytes: number[] = [];
  for (const char of secret) {
    acc = (acc << 5) | alphabet.indexOf(char); bits += 5;
    if (bits >= 8) { bytes.push((acc >>> (bits - 8)) & 255); bits -= 8; }
  }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, '0');
}

describe('AuthService administrator MFA', () => {
  const password = 'StrongPass1!';
  const admin = {
    id: 'admin-1', name: 'Operator', email: 'operator@example.test', role: 'SUPER_ADMIN', isVerified: true,
    passwordHash: 'password-hash', sessionVersion: 3, adminMfaEnabledAt: null, deletionRequestedAt: null, suspendedAt: null,
    plan: 'FREE', planExpiresAt: null, trialEndsAt: null, termsVersion: null, privacyVersion: null, ageConfirmedAt: null,
  };

  it('does not issue a normal session before an administrator enrolls MFA', async () => {
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const compare = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(admin), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      refreshToken: { create: jest.fn() },
    };
    const jwt: any = { signAsync: jest.fn().mockResolvedValue('setup-challenge') };
    const service = new AuthService(prisma, jwt, { getOrThrow: () => 'test-secret' } as any, {} as any, {} as any);
    try {
      await expect(service.login(admin.email, password)).resolves.toEqual({
        mfaRequired: false, mfaSetupRequired: true, challenge: 'setup-challenge',
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: admin.id, role: { in: ['ADMIN', 'SUPER_ADMIN', 'INFLUENCER'] }, sessionVersion: 3 }),
        data: expect.objectContaining({ adminMfaChallengeHash: hashRefreshToken('setup-challenge') }),
      }));
    } finally { compare.mockRestore(); }
  });

  it('requires the current password to stage an encrypted authenticator secret', async () => {
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const compare = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    const prisma: any = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: admin.id, email: admin.email, passwordHash: 'password-hash' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const jwt: any = { verifyAsync: jest.fn().mockResolvedValue({ sub: admin.id, sv: 3 }) };
    const encryption: any = { encrypt: jest.fn((value: string) => `encrypted:${value}`) };
    const service = new AuthService(prisma, jwt, { getOrThrow: () => 'test-secret' } as any, {} as any, encryption);
    try {
      const staged = await service.beginAdminMfaSetup('setup-challenge', password);
      expect(staged).toMatchObject({ secret: expect.stringMatching(/^[A-Z2-7]{32}$/), otpauthUri: expect.stringContaining('otpauth://totp/') });
      expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ sessionVersion: 3, adminMfaChallengeHash: hashRefreshToken('setup-challenge') }),
        data: expect.objectContaining({ adminMfaPendingSecretEnc: `encrypted:${staged.secret}` }),
      }));
    } finally { compare.mockRestore(); }
  });

  it('activates MFA once, saves hashed recovery codes, and revokes legacy sessions', async () => {
    const step = Math.floor(Date.now() / 30_000);
    const secret = 'JBSWY3DPEHPK3PXP';
    const challenge = 'setup-challenge';
    const row = { ...admin, adminMfaEnabledAt: null, adminMfaPendingSecretEnc: 'encrypted-pending' };
    const prisma: any = {
      user: { findFirst: jest.fn().mockResolvedValue(row), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }), create: jest.fn().mockResolvedValue({}) },
    };
    const jwt: any = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: admin.id, sv: 3 }),
      signAsync: jest.fn().mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token'),
    };
    const service = new AuthService(prisma, jwt, { getOrThrow: () => 'test-secret', get: (_key: string, fallback: string) => fallback } as any,
      {} as any, { decrypt: () => secret } as any);
    const result = await service.confirmAdminMfaSetup(challenge, totpAt(secret, step));
    expect(result.user).toMatchObject({ role: 'SUPER_ADMIN' });
    expect(result.recoveryCodes).toHaveLength(10);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ adminMfaChallengeHash: hashRefreshToken(challenge), sessionVersion: 3 }),
      data: expect.objectContaining({ adminMfaEnabledAt: expect.any(Date), sessionVersion: { increment: 1 } }),
    }));
    const savedRecoveryHashes = prisma.user.updateMany.mock.calls[0][0].data.adminMfaRecoveryCodeHashes;
    expect(savedRecoveryHashes).not.toContain(result.recoveryCodes[0]);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: admin.id } });
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(jwt.signAsync.mock.calls[0][0].sv).toBe(4);
  });

  it('verifies the authenticator, consumes the challenge and rejects a replayed TOTP step', async () => {
    const step = Math.floor(Date.now() / 30_000);
    const secret = 'JBSWY3DPEHPK3PXP';
    const row = { ...admin, adminMfaEnabledAt: new Date(), adminMfaSecretEnc: 'encrypted-secret', adminMfaRecoveryCodeHashes: [], adminMfaLastUsedStep: BigInt(step - 1) };
    const prisma: any = {
      user: { findFirst: jest.fn().mockResolvedValue(row), updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const jwt: any = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: admin.id, sv: 3 }),
      signAsync: jest.fn().mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token'),
    };
    const service = new AuthService(prisma, jwt, { getOrThrow: () => 'test-secret', get: (_key: string, fallback: string) => fallback } as any,
      {} as any, { decrypt: () => secret } as any);
    const challenge = 'challenge-token';
    const code = totpAt(secret, step);

    await expect(service.verifyAdminMfa(challenge, code)).resolves.toMatchObject({ user: { role: 'SUPER_ADMIN' } });
    await expect(service.verifyAdminMfa(challenge, code)).rejects.toThrow('already used');
    expect(prisma.user.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ id: admin.id, adminMfaChallengeHash: hashRefreshToken(challenge), OR: expect.any(Array) }),
      data: expect.objectContaining({ adminMfaChallengeHash: null, adminMfaLastUsedStep: BigInt(step) }),
    }));
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('accepts a recovery code once and atomically removes its stored hash', async () => {
    const challenge = 'recovery-challenge';
    const secret = 'JBSWY3DPEHPK3PXP';
    const recovery = 'A1B2-C3D4-E5F6-7788';
    const hash = recoveryCodeHash(recovery, 'test-secret');
    const row = { ...admin, adminMfaEnabledAt: new Date(), adminMfaSecretEnc: 'enc', adminMfaRecoveryCodeHashes: [hash], adminMfaLastUsedStep: null };
    const prisma: any = {
      user: { findFirst: jest.fn().mockResolvedValue(row), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const jwt: any = { verifyAsync: jest.fn().mockResolvedValue({ sub: admin.id, sv: 3 }), signAsync: jest.fn().mockResolvedValue('signed') };
    const service = new AuthService(prisma, jwt, { getOrThrow: () => 'test-secret', get: (_key: string, fallback: string) => fallback } as any,
      {} as any, { decrypt: () => secret } as any);
    await service.verifyAdminMfa(challenge, recovery);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ adminMfaRecoveryCodeHashes: { has: hash } }),
      data: expect.objectContaining({ adminMfaRecoveryCodeHashes: { set: [] } }),
    }));
  });
});
