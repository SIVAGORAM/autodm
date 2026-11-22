import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailOutboxService } from '../mail/mail-outbox.service';
import { effectivePlan } from '../common/plan.util';
import { EncryptionService } from '../common/encryption.service';
import { authenticatorUri, newRecoveryCodes, newTotpSecret, recoveryCodeHash, totpStep } from './admin-mfa';

// Valid cost-12 hash with no associated account/password. Unknown-email login
// attempts must perform the same expensive bcrypt operation as real accounts.
export const DUMMY_PASSWORD_HASH = '$2a$12$xJ1mFyTO28OUgMRBet5xPeZNy0LXFS0N8VLz0ppxW5lxHDvdzjhQK';

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export type AuthLoginResult =
  | { user: Record<string, unknown>; accessToken: string; refreshToken: string }
  | { mfaRequired: boolean; mfaSetupRequired: boolean; challenge: string };

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mailOutbox: MailOutboxService,
    private encryption: EncryptionService,
  ) {}

  private genOtp() { return randomInt(100000, 1_000_000).toString(); }

  private otpDigest(code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET')).update(code).digest('hex');
  }

  async signup(name: string, email: string, password: string, termsVersion: string, privacyVersion: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 12);
    const otpCode = this.genOtp();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    const policyAcceptedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name, email, passwordHash, otpCode: this.otpDigest(otpCode), otpExpires,
          termsVersion, termsAcceptedAt: policyAcceptedAt,
          privacyVersion, privacyAcknowledgedAt: policyAcceptedAt,
          ageConfirmedAt: policyAcceptedAt,
        },
        select: {
          id: true, name: true, email: true, role: true, plan: true, isVerified: true,
          termsVersion: true, privacyVersion: true, ageConfirmedAt: true,
        },
      });
      await this.mailOutbox.queueVerification(tx, created.id, email, otpCode, otpExpires);
      const tokens = await this.createTokenPair(created.id, created.email, created.role, 0);
      await tx.refreshToken.create({
        data: { id: tokens.refreshTokenId, tokenHash: hashRefreshToken(tokens.refreshToken), userId: created.id, expiresAt: tokens.refreshTokenExpiresAt },
      });
      return { user: created, tokens };
    });
    return { user: result.user, verificationEmailQueued: true, ...result.tokens };
  }

  async login(email: string, password: string): Promise<AuthLoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Constant-time-ish: always run a compare to blunt user-enumeration timing.
    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    if (!user || !valid || user.deletionRequestedAt || user.suspendedAt || (user.role !== 'INFLUENCER' && !user.isVerified)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.role !== 'INFLUENCER') {
      const challenge = await this.createAdminMfaChallenge(user.id, user.email, user.role, user.sessionVersion,
        user.adminMfaEnabledAt ? 'verify' : 'setup');
      return { mfaRequired: !!user.adminMfaEnabledAt, mfaSetupRequired: !user.adminMfaEnabledAt, challenge };
    }
    const tokens = await this.issueTokens(user.id, user.email, user.role, user.sessionVersion);
    return {
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        adminPermissions: user.adminPermissions,
        plan: effectivePlan(user), isVerified: user.isVerified,
        termsVersion: user.termsVersion, privacyVersion: user.privacyVersion, ageConfirmedAt: user.ageConfirmedAt,
      },
      ...tokens,
    };
  }

  async beginAdminMfaSetup(challengeToken: string, currentPassword: string) {
    const claims = await this.verifyAdminChallenge(challengeToken, 'admin-mfa-setup');
    const user = await this.prisma.user.findFirst({
      where: { id: claims.sub, sessionVersion: claims.sv, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletionRequestedAt: null, suspendedAt: null,
        adminMfaChallengeHash: hashRefreshToken(challengeToken), adminMfaChallengeExpiresAt: { gt: new Date() } },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user || !await bcrypt.compare(currentPassword, user.passwordHash)) throw new UnauthorizedException('Invalid or expired administrator setup session.');
    const secret = newTotpSecret();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const changed = await this.prisma.user.updateMany({
      where: { id: user.id, sessionVersion: claims.sv, adminMfaChallengeHash: hashRefreshToken(challengeToken), adminMfaChallengeExpiresAt: { gt: new Date() } },
      data: { adminMfaPendingSecretEnc: this.encryption.encrypt(secret), adminMfaChallengeExpiresAt: expiresAt },
    });
    if (changed.count !== 1) throw new UnauthorizedException('Invalid or expired administrator setup session.');
    return { secret, otpauthUri: authenticatorUri(secret, user.email), expiresAt };
  }

  async confirmAdminMfaSetup(challengeToken: string, code: string) {
    const claims = await this.verifyAdminChallenge(challengeToken, 'admin-mfa-setup');
    const challengeHash = hashRefreshToken(challengeToken);
    const user = await this.prisma.user.findFirst({
      where: { id: claims.sub, sessionVersion: claims.sv, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletionRequestedAt: null, suspendedAt: null,
        adminMfaEnabledAt: null, adminMfaPendingSecretEnc: { not: null }, adminMfaChallengeHash: challengeHash,
        adminMfaChallengeExpiresAt: { gt: new Date() } },
      select: { id: true, name: true, email: true, role: true, adminPermissions: true, sessionVersion: true, plan: true, planExpiresAt: true, trialEndsAt: true,
        isVerified: true, termsVersion: true, privacyVersion: true, ageConfirmedAt: true, adminMfaPendingSecretEnc: true },
    });
    if (!user?.adminMfaPendingSecretEnc) throw new UnauthorizedException('Invalid or expired administrator setup session.');
    let secret: string;
    try { secret = this.encryption.decrypt(user.adminMfaPendingSecretEnc); } catch { throw new UnauthorizedException('Invalid administrator setup.'); }
    const step = totpStep(secret, code);
    if (step === null) throw new BadRequestException('The authenticator code is invalid or expired.');
    const recoveryCodes = newRecoveryCodes();
    const recoveryHashes = recoveryCodes.map((value) => recoveryCodeHash(value, this.config.getOrThrow('JWT_ACCESS_SECRET')));
    const enabledAt = new Date();
    const updated = await this.prisma.user.updateMany({
      where: { id: user.id, role: user.role, adminMfaEnabledAt: null, adminMfaPendingSecretEnc: user.adminMfaPendingSecretEnc,
        adminMfaChallengeHash: challengeHash, adminMfaChallengeExpiresAt: { gt: new Date() }, sessionVersion: claims.sv },
      data: {
        adminMfaEnabledAt: enabledAt, adminMfaSecretEnc: user.adminMfaPendingSecretEnc,
        adminMfaPendingSecretEnc: null, adminMfaRecoveryCodeHashes: recoveryHashes,
        adminMfaChallengeHash: null, adminMfaChallengeExpiresAt: null, adminMfaLastUsedStep: BigInt(step),
        sessionVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new UnauthorizedException('Administrator setup session was already used. Sign in again.');
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    const tokens = await this.issueTokens(user.id, user.email, user.role, user.sessionVersion + 1);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role,
        adminPermissions: user.adminPermissions,
        plan: effectivePlan(user), isVerified: user.isVerified, termsVersion: user.termsVersion,
        privacyVersion: user.privacyVersion, ageConfirmedAt: user.ageConfirmedAt },
      recoveryCodes, ...tokens,
    };
  }

  async verifyAdminMfa(challengeToken: string, code: string) {
    const claims = await this.verifyAdminChallenge(challengeToken, 'admin-mfa-challenge');
    const challengeHash = hashRefreshToken(challengeToken);
    const user = await this.prisma.user.findFirst({
      where: { id: claims.sub, sessionVersion: claims.sv, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletionRequestedAt: null, suspendedAt: null,
        adminMfaEnabledAt: { not: null }, adminMfaSecretEnc: { not: null }, adminMfaChallengeHash: challengeHash,
        adminMfaChallengeExpiresAt: { gt: new Date() } },
      select: { id: true, name: true, email: true, role: true, adminPermissions: true, sessionVersion: true, plan: true, planExpiresAt: true,
        trialEndsAt: true, isVerified: true, termsVersion: true, privacyVersion: true, ageConfirmedAt: true,
        adminMfaSecretEnc: true, adminMfaRecoveryCodeHashes: true },
    });
    if (!user?.adminMfaSecretEnc) throw new UnauthorizedException('Invalid or expired administrator sign-in.');
    let secret: string;
    try { secret = this.encryption.decrypt(user.adminMfaSecretEnc); } catch { throw new UnauthorizedException('Administrator MFA is unavailable.'); }
    const step = totpStep(secret, code);
    const recoveryHash = step === null ? recoveryCodeHash(code, this.config.getOrThrow('JWT_ACCESS_SECRET')) : null;
    const recoveryIndex = recoveryHash ? user.adminMfaRecoveryCodeHashes.indexOf(recoveryHash) : -1;
    if (step === null && recoveryIndex < 0) throw new UnauthorizedException('Invalid administrator sign-in code.');
    const now = new Date();
    const where: any = {
      id: user.id, role: user.role, adminMfaChallengeHash: challengeHash, adminMfaChallengeExpiresAt: { gt: now },
      deletionRequestedAt: null, suspendedAt: null, sessionVersion: claims.sv,
    };
    const data: any = { adminMfaChallengeHash: null, adminMfaChallengeExpiresAt: null };
    if (step !== null) {
      where.OR = [{ adminMfaLastUsedStep: null }, { adminMfaLastUsedStep: { lt: BigInt(step) } }];
      data.adminMfaLastUsedStep = BigInt(step);
    } else {
      where.adminMfaRecoveryCodeHashes = { has: recoveryHash };
      data.adminMfaRecoveryCodeHashes = { set: user.adminMfaRecoveryCodeHashes.filter((_item, index) => index !== recoveryIndex) };
    }
    const consumed = await this.prisma.user.updateMany({ where, data });
    if (consumed.count !== 1) throw new UnauthorizedException('This MFA code or sign-in session was already used. Sign in again.');
    const tokens = await this.issueTokens(user.id, user.email, user.role, user.sessionVersion);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role,
        adminPermissions: user.adminPermissions,
        plan: effectivePlan(user), isVerified: user.isVerified, termsVersion: user.termsVersion,
        privacyVersion: user.privacyVersion, ageConfirmedAt: user.ageConfirmedAt },
      ...tokens,
    };
  }

  private async createAdminMfaChallenge(userId: string, email: string, role: string, sessionVersion: number, flow: 'setup' | 'verify') {
    const audience = flow === 'setup' ? 'admin-mfa-setup' : 'admin-mfa-challenge';
    const token = await this.jwt.signAsync(
      { sub: userId, email, role, sv: sessionVersion, jti: randomUUID() },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '5m', issuer: 'autodm', audience },
    );
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    const saved = await this.prisma.user.updateMany({
      where: { id: userId, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, sessionVersion, deletionRequestedAt: null, suspendedAt: null },
      data: { adminMfaChallengeHash: hashRefreshToken(token), adminMfaChallengeExpiresAt: expiresAt },
    });
    if (saved.count !== 1) throw new UnauthorizedException('Invalid email or password');
    return token;
  }

  private async verifyAdminChallenge(token: string, audience: 'admin-mfa-setup' | 'admin-mfa-challenge') {
    try {
      return await this.jwt.verifyAsync<{ sub: string; sv: number }>(token, {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), issuer: 'autodm', audience,
      });
    } catch { throw new UnauthorizedException('Invalid or expired administrator sign-in.'); }
  }

  async refresh(rawToken: string) {
    let payload: { sub: string; jti: string; sv?: number };
    try {
      payload = await this.jwt.verifyAsync(rawToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        issuer: 'autodm', audience: 'web-client',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: { select: { id: true, email: true, role: true, deletionRequestedAt: true, suspendedAt: true, sessionVersion: true, adminMfaEnabledAt: true } } },
    });
    const tokenHash = hashRefreshToken(rawToken);
    if (!stored || stored.tokenHash !== tokenHash) {
      // Reuse detected — nuke the family.
      await this.prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
      throw new UnauthorizedException('Token reuse detected');
    }
    if (stored.user.deletionRequestedAt || stored.user.suspendedAt) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: stored.user.id } });
      throw new UnauthorizedException('Account is unavailable.');
    }
    if (stored.user.role !== 'INFLUENCER' && !stored.user.adminMfaEnabledAt) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: stored.user.id } });
      throw new UnauthorizedException('Administrator MFA setup is required. Sign in again to secure the account.');
    }
    if (stored.user.role !== 'INFLUENCER' && payload.sv !== stored.user.sessionVersion) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: stored.user.id } });
      throw new UnauthorizedException('Administrator session expired. Sign in again.');
    }
    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Refresh token expired');
    }
    const tokens = await this.createTokenPair(stored.user.id, stored.user.email, stored.user.role, stored.user.sessionVersion);
    const rotated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refreshToken.deleteMany({
        where: { id: stored.id, userId: stored.user.id, tokenHash, expiresAt: { gt: new Date() } },
      });
      if (claimed.count !== 1) {
        // Commit family revocation before returning the replay error.
        await tx.refreshToken.deleteMany({ where: { userId: stored.user.id } });
        return false;
      }
      await tx.refreshToken.create({ data: {
        id: tokens.refreshTokenId,
        tokenHash: hashRefreshToken(tokens.refreshToken),
        userId: stored.user.id,
        expiresAt: tokens.refreshTokenExpiresAt,
      } });
      return true;
    });
    if (!rotated) throw new UnauthorizedException('Token reuse detected');
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(rawToken?: string) {
    if (!rawToken) return;
    try {
      const payload: any = await this.jwt.verifyAsync(rawToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), issuer: 'autodm', audience: 'web-client',
      });
      await this.prisma.refreshToken.deleteMany({ where: { id: payload.jti } });
    } catch { /* already invalid */ }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true, adminPermissions: true, plan: true, planExpiresAt: true, trialEndsAt: true, isVerified: true, createdAt: true,
        termsVersion: true, termsAcceptedAt: true, privacyVersion: true, privacyAcknowledgedAt: true, ageConfirmedAt: true,
        igAccounts: { select: { id: true, username: true, isActive: true } },
      },
    });
    if (!user) return null;
    const { planExpiresAt, trialEndsAt, ...profile } = user;
    return { ...profile, plan: effectivePlan({ ...user, planExpiresAt, trialEndsAt }) };
  }

  async acceptLegalPolicies(userId: string, termsVersion: string, privacyVersion: string) {
    const acceptedAt = new Date();
    const updated = await this.prisma.user.updateMany({
      where: { id: userId },
      data: {
        termsVersion, termsAcceptedAt: acceptedAt,
        privacyVersion, privacyAcknowledgedAt: acceptedAt,
        ageConfirmedAt: acceptedAt,
      },
    });
    if (updated.count !== 1) throw new UnauthorizedException('Account not found.');
  }

  async verifyOtp(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.isVerified) return { success: true };
    if (!/^\d{6}$/.test(code) || !user.otpCode || !user.otpExpires || user.otpExpires < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (user.otpAttempts >= 5) throw new BadRequestException('Too many attempts. Request a new code.');
    const digest = this.otpDigest(code);
    const storedDigest = Buffer.from(user.otpCode);
    const suppliedDigest = Buffer.from(digest);
    const rawCode = Buffer.from(code);
    const validDigest = storedDigest.length === suppliedDigest.length && timingSafeEqual(storedDigest, suppliedDigest);
    const validLegacyCode = storedDigest.length === rawCode.length && timingSafeEqual(storedDigest, rawCode);
    const valid = validDigest || validLegacyCode;
    if (!valid) {
      await this.prisma.user.updateMany({
        where: { id: userId, isVerified: false, otpCode: user.otpCode, otpAttempts: { lt: 5 } },
        data: { otpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid or expired code');
    }
    const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const verified = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: userId, isVerified: false, otpCode: user.otpCode, otpExpires: { gt: new Date() }, otpAttempts: { lt: 5 } },
        data: {
          isVerified: true,
          trialEndsAt,
          trialReminderSent: false,
          otpCode: null,
          otpExpires: null,
          otpAttempts: 0,
        },
      });
      if (changed.count === 1) await this.mailOutbox.queueWelcome(tx, user.id, user.email, user.name, trialEndsAt);
      return changed;
    });
    if (verified.count !== 1) throw new BadRequestException('Invalid or expired code');
    return { success: true };
  }

  async resendOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.isVerified) return { success: true };
    const otpCode = this.genOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { otpCode: this.otpDigest(otpCode), otpExpires: expiresAt, otpAttempts: 0 } });
      await this.mailOutbox.queueVerification(tx, user.id, user.email, otpCode, expiresAt);
    });
    return { success: true, emailQueued: true };
  }

  async verificationEmailStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true, otpExpires: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.isVerified) return { success: true, status: 'verified' as const };
    if (!user.otpExpires || user.otpExpires <= new Date()) return { success: true, status: 'expired' as const };

    const message = await this.prisma.mailOutbox.findUnique({
      where: { dedupeKey: `verification:${userId}:${user.otpExpires.getTime()}` },
      select: { status: true, attempts: true, expiresAt: true },
    });
    if (!message) return { success: true, status: 'not_queued' as const };

    if (message.status === 'SENT') return { success: true, status: 'sent' as const };
    if (message.status === 'PROCESSING') return { success: true, status: 'sending' as const };
    if (message.status === 'PENDING') {
      return { success: true, status: message.attempts > 0 ? 'retrying' as const : 'queued' as const };
    }
    if (message.status === 'CANCELLED') {
      return {
        success: true,
        status: message.expiresAt <= new Date() ? 'expired' as const : 'superseded' as const,
      };
    }
    return { success: true, status: 'failed' as const };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { success: true };
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt },
      });
      await this.mailOutbox.queuePasswordReset(tx, user.id, user.email, token, expiresAt);
    });
    return { success: true };
  }

  async resetPassword(token: string, password: string) {
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new BadRequestException('Invalid or expired reset link.');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset link.');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: user.id, passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() } },
        data: {
          passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null,
          sessionVersion: { increment: 1 }, adminMfaChallengeHash: null, adminMfaChallengeExpiresAt: null,
          adminMfaPendingSecretEnc: null,
        },
      });
      if (updated.count !== 1) throw new BadRequestException('Invalid or expired reset link.');
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    });
    return { success: true };
  }

  private async issueTokens(userId: string, email: string, role: string, sessionVersion: number) {
    const pair = await this.createTokenPair(userId, email, role, sessionVersion);
    await this.prisma.refreshToken.create({
      data: { id: pair.refreshTokenId, tokenHash: hashRefreshToken(pair.refreshToken), userId, expiresAt: pair.refreshTokenExpiresAt },
    });
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
  }

  private async createTokenPair(userId: string, email: string, role: string, sessionVersion: number) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role, sv: sessionVersion },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'), issuer: 'autodm', audience: 'web-client' },
    );
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti, sv: sessionVersion },
      { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'), issuer: 'autodm', audience: 'web-client' },
    );
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return { accessToken, refreshToken, refreshTokenId: jti, refreshTokenExpiresAt };
  }
}
