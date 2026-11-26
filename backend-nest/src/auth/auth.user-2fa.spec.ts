import { createHmac } from 'node:crypto';
import { AuthService } from './auth.service';
import { decodeBase32 } from './admin-mfa';

function totpAt(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, '0');
}

describe('AuthService Influencer 2FA', () => {
  const password = 'StrongPass1!';
  const influencer = {
    id: 'user-1',
    name: 'Creator One',
    email: 'creator@example.test',
    role: 'INFLUENCER',
    isVerified: true,
    passwordHash: 'password-hash',
    sessionVersion: 1,
    adminMfaEnabledAt: null,
    adminMfaSecretEnc: null,
    adminMfaPendingSecretEnc: null,
    adminMfaRecoveryCodeHashes: [],
    deletionRequestedAt: null,
    suspendedAt: null,
    plan: 'FREE',
    planExpiresAt: null,
    trialEndsAt: null,
    termsVersion: null,
    privacyVersion: null,
    ageConfirmedAt: null,
  };

  it('allows influencer to log in without MFA when 2FA is not enabled', async () => {
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const compare = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(influencer), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const jwt: any = {
      signAsync: jest.fn().mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token'),
    };
    const service = new AuthService(prisma, jwt, { getOrThrow: () => 'test-secret', get: (_key: string, fb: string) => fb } as any, {} as any, {} as any);
    try {
      const result = await service.login(influencer.email, password);
      expect('accessToken' in result).toBe(true);
      expect('mfaRequired' in result).toBe(false);
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    } finally {
      compare.mockRestore();
    }
  });

  it('triggers MFA challenge when influencer has 2FA enabled', async () => {
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const compare = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    const mfaInfluencer = { ...influencer, adminMfaEnabledAt: new Date(), adminMfaSecretEnc: 'enc-secret' };
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(mfaInfluencer), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      refreshToken: { create: jest.fn() },
    };
    const jwt: any = { signAsync: jest.fn().mockResolvedValue('mfa-challenge') };
    const service = new AuthService(prisma, jwt, { getOrThrow: () => 'test-secret' } as any, {} as any, {} as any);
    try {
      const result = await service.login(influencer.email, password);
      expect(result).toEqual({
        mfaRequired: true,
        mfaSetupRequired: false,
        challenge: 'mfa-challenge',
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    } finally {
      compare.mockRestore();
    }
  });

  it('returns 2FA status and indicates optional for influencer vs mandatory for admin', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'inf-1', role: 'INFLUENCER', adminMfaEnabledAt: null, adminMfaRecoveryCodeHashes: [] })
          .mockResolvedValueOnce({ id: 'adm-1', role: 'ADMIN', adminMfaEnabledAt: new Date(), adminMfaRecoveryCodeHashes: ['hash1', 'hash2'] }),
      },
    };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    const infStatus = await service.getUser2faStatus('inf-1');
    expect(infStatus).toEqual({
      enabled: false,
      enabledAt: null,
      recoveryCodesRemaining: 0,
      isMandatory: false,
    });

    const admStatus = await service.getUser2faStatus('adm-1');
    expect(admStatus).toEqual({
      enabled: true,
      enabledAt: expect.any(Date),
      recoveryCodesRemaining: 2,
      isMandatory: true,
    });
  });

  it('begins 2FA setup with valid password, rejecting incorrect password', async () => {
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const compare = jest.spyOn(bcrypt, 'compare')
      .mockResolvedValueOnce(false as never)
      .mockResolvedValueOnce(true as never);
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(influencer),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const encryption: any = { encrypt: jest.fn((val: string) => `enc:${val}`) };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, encryption);

    try {
      await expect(service.beginUser2faSetup(influencer.id, 'wrong-password')).rejects.toThrow('Incorrect current password');

      const setup = await service.beginUser2faSetup(influencer.id, password);
      expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(setup.otpauthUri).toContain('otpauth://totp/');
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: influencer.id },
        data: { adminMfaPendingSecretEnc: `enc:${setup.secret}` },
      });
    } finally {
      compare.mockRestore();
    }
  });

  it('confirms 2FA setup with valid TOTP code and generates 10 recovery codes', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const step = Math.floor(Date.now() / 30_000);
    const code = totpAt(secret, step);
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: influencer.id, adminMfaPendingSecretEnc: 'enc-pending' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const encryption: any = { decrypt: jest.fn().mockReturnValue(secret) };
    const config: any = { getOrThrow: () => 'test-pepper' };
    const service = new AuthService(prisma, {} as any, config, {} as any, encryption);

    const result = await service.confirmUser2faSetup(influencer.id, code);
    expect(result.success).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: influencer.id },
      data: expect.objectContaining({
        adminMfaEnabledAt: expect.any(Date),
        adminMfaSecretEnc: 'enc-pending',
        adminMfaPendingSecretEnc: null,
        adminMfaRecoveryCodeHashes: expect.any(Array),
      }),
    }));
  });

  it('prevents administrators from disabling 2FA', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin-1',
          role: 'ADMIN',
          passwordHash: 'hash',
          adminMfaEnabledAt: new Date(),
          adminMfaSecretEnc: 'enc-secret',
          adminMfaRecoveryCodeHashes: [],
        }),
      },
    };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(service.disableUser2fa('admin-1', password, '123456')).rejects.toThrow(
      'Two-factor authentication is mandatory for administrators'
    );
  });

  it('allows influencer to disable 2FA with password and valid TOTP code', async () => {
    const bcrypt = require('bcryptjs') as typeof import('bcryptjs');
    const compare = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    const secret = 'JBSWY3DPEHPK3PXP';
    const step = Math.floor(Date.now() / 30_000);
    const code = totpAt(secret, step);
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: influencer.id,
          role: 'INFLUENCER',
          passwordHash: 'hash',
          adminMfaEnabledAt: new Date(),
          adminMfaSecretEnc: 'enc-secret',
          adminMfaRecoveryCodeHashes: [],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const encryption: any = { decrypt: jest.fn().mockReturnValue(secret) };
    const config: any = { getOrThrow: () => 'test-pepper' };
    const service = new AuthService(prisma, {} as any, config, {} as any, encryption);

    try {
      const result = await service.disableUser2fa(influencer.id, password, code);
      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: influencer.id },
        data: {
          adminMfaEnabledAt: null,
          adminMfaSecretEnc: null,
          adminMfaPendingSecretEnc: null,
          adminMfaRecoveryCodeHashes: [],
          adminMfaLastUsedStep: null,
        },
      });
    } finally {
      compare.mockRestore();
    }
  });
});
