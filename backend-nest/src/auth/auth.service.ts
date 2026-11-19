import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  private genOtp() { return Math.floor(100000 + Math.random() * 900000).toString(); }

  async signup(name: string, email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 12);
    const otpCode = this.genOtp();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    const user = await this.prisma.user.create({
      data: { name, email, passwordHash, otpCode, otpExpires },
      select: { id: true, name: true, email: true, role: true, plan: true },
    });
    this.log.log(`[OTP] verification code for ${email}: ${otpCode}`);
    await this.mail.sendVerificationEmail(email, otpCode);
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return { user, ...tokens };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Constant-time-ish: always run a compare to blunt user-enumeration timing.
    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, '$2a$12$placeholderplaceholderplaceholderplaceholderpla');
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan, isVerified: user.isVerified },
      ...tokens,
    };
  }

  async refresh(rawToken: string) {
    let payload: { sub: string; jti: string };
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
      include: { user: { select: { id: true, email: true, role: true } } },
    });
    if (!stored || stored.token !== rawToken) {
      // Reuse detected — nuke the family.
      await this.prisma.refreshToken.deleteMany({ where: { userId: payload.sub } });
      throw new UnauthorizedException('Token reuse detected');
    }
    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Refresh token expired');
    }
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.issueTokens(stored.user.id, stored.user.email, stored.user.role);
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
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true, plan: true, isVerified: true, createdAt: true,
        igAccounts: { select: { id: true, username: true, isActive: true } },
      },
    });
  }

  async verifyOtp(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.isVerified) return { success: true };
    if (!user.otpCode || user.otpCode !== code || !user.otpExpires || user.otpExpires < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { isVerified: true, otpCode: null, otpExpires: null } });
    return { success: true };
  }

  async resendOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.isVerified) return { success: true };
    const otpCode = this.genOtp();
    await this.prisma.user.update({ where: { id: userId }, data: { otpCode, otpExpires: new Date(Date.now() + 15 * 60 * 1000) } });
    this.log.log(`[OTP] resent code for ${user.email}: ${otpCode}`);
    await this.mail.sendVerificationEmail(user.email, otpCode);
    return { success: true };
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'), issuer: 'autodm', audience: 'web-client' },
    );
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti },
      { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'), issuer: 'autodm', audience: 'web-client' },
    );
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({ data: { id: jti, token: refreshToken, userId, expiresAt } });
    return { accessToken, refreshToken };
  }
}
