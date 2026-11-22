import { BadRequestException, Body, Controller, Get, Post, Req, Res, ServiceUnavailableException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { adminMfaCodeSchema, adminMfaSetupSchema, forgotPasswordSchema, legalAcceptanceSchema, loginSchema, resetPasswordSchema, signupSchema, verifyOtpSchema } from './auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private auth: AuthService, private config: ConfigService) {}

  @Throttle({ default: { limit: 8, ttl: 60_000 } }) // brute-force protection
  @Post('signup')
  async signup(@Body() body: unknown, @Res({ passthrough: true }) res: FastifyReply) {
    if (this.config.get('NODE_ENV') === 'production' && this.config.get('LEGAL_POLICY_STATUS', 'DRAFT') !== 'APPROVED') {
      throw new ServiceUnavailableException('Sign-up is temporarily unavailable while the legal policies are being finalized.');
    }
    const { name, email, password, termsVersion, privacyVersion } = signupSchema.parse(body);
    const { user, accessToken, refreshToken, verificationEmailQueued } = await this.auth.signup(
      name, email, password, termsVersion, privacyVersion,
    );
    this.setCookies(res, accessToken, refreshToken);
    return { success: true, data: { user, verificationEmailQueued } };
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } }) // brute-force protection
  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: FastifyReply) {
    const { email, password } = loginSchema.parse(body);
    const result = await this.auth.login(email, password);
    if ('mfaRequired' in result) {
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/api/auth' });
      this.setAdminMfaChallengeCookie(res, result.challenge);
      return { success: true, data: { mfaRequired: result.mfaRequired, mfaSetupRequired: result.mfaSetupRequired } };
    }
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { success: true, data: { user: result.user } };
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('admin-mfa/setup')
  async beginAdminMfaSetup(@Req() req: FastifyRequest, @Body() body: unknown) {
    const { currentPassword } = adminMfaSetupSchema.parse(body);
    const challenge = (req as any).cookies?.admin_mfa_challenge;
    if (!challenge) throw new UnauthorizedException('Administrator sign-in session expired. Sign in again.');
    return { success: true, data: await this.auth.beginAdminMfaSetup(challenge, currentPassword) };
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('admin-mfa/confirm')
  async confirmAdminMfa(@Req() req: FastifyRequest, @Body() body: unknown, @Res({ passthrough: true }) res: FastifyReply) {
    const { code } = adminMfaCodeSchema.parse(body);
    const challenge = (req as any).cookies?.admin_mfa_challenge;
    if (!challenge) throw new UnauthorizedException('Administrator sign-in session expired. Sign in again.');
    const result = await this.auth.confirmAdminMfaSetup(challenge, code);
    this.clearAdminMfaChallengeCookie(res);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { success: true, data: { user: result.user, recoveryCodes: result.recoveryCodes } };
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('admin-mfa/verify')
  async verifyAdminMfa(@Req() req: FastifyRequest, @Body() body: unknown, @Res({ passthrough: true }) res: FastifyReply) {
    const { code } = adminMfaCodeSchema.parse(body);
    const challenge = (req as any).cookies?.admin_mfa_challenge;
    if (!challenge) throw new UnauthorizedException('Administrator sign-in session expired. Sign in again.');
    const result = await this.auth.verifyAdminMfa(challenge, code);
    this.clearAdminMfaChallengeCookie(res);
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { success: true, data: { user: result.user } };
  }

  @Post('refresh')
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const token = (req as any).cookies?.refresh_token;
    if (!token) throw new UnauthorizedException('No refresh token');
    const { accessToken, refreshToken } = await this.auth.refresh(token);
    this.setCookies(res, accessToken, refreshToken);
    return { success: true };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    await this.auth.logout((req as any).cookies?.refresh_token);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser('userId') userId: string) {
    return { success: true, data: { user: await this.auth.me(userId) } };
  }

  @Post('accept-policies')
  @UseGuards(JwtAuthGuard)
  async acceptPolicies(@CurrentUser('userId') userId: string, @Body() body: unknown) {
    const acceptance = legalAcceptanceSchema.parse(body);
    await this.auth.acceptLegalPolicies(userId, acceptance.termsVersion, acceptance.privacyVersion);
    return { success: true };
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  async verifyOtp(@CurrentUser('userId') userId: string, @Body() body: unknown) {
    const { code } = verifyOtpSchema.parse(body);
    return this.auth.verifyOtp(userId, code);
  }

  @Post('resend-otp')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  async resendOtp(@CurrentUser('userId') userId: string) {
    return this.auth.resendOtp(userId);
  }

  @Get('verification-email-status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  async verificationEmailStatus(@CurrentUser('userId') userId: string) {
    return this.auth.verificationEmailStatus(userId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: unknown) {
    const { email } = forgotPasswordSchema.parse(body);
    await this.auth.requestPasswordReset(email);
    return { success: true, message: 'If an account exists for that email, a reset link has been sent.' };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() body: unknown, @Res({ passthrough: true }) res: FastifyReply) {
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((issue) => issue.message));
    await this.auth.resetPassword(parsed.data.token, parsed.data.password);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/auth' });
    return { success: true };
  }

  private setCookies(res: FastifyReply, accessToken: string, refreshToken: string) {
    const secure = this.config.get('COOKIE_SECURE', false) === true || this.config.get('COOKIE_SECURE') === 'true';
    // Cross-site (frontend and backend on different domains) requires SameSite=None + Secure.
    // Same-origin local dev uses Lax over http.
    const sameSite: 'none' | 'lax' = secure ? 'none' : 'lax';
    res.setCookie('access_token', accessToken, {
      httpOnly: true, secure, sameSite, path: '/', maxAge: 15 * 60,
    });
    res.setCookie('refresh_token', refreshToken, {
      httpOnly: true, secure, sameSite, path: '/api/auth', maxAge: 30 * 24 * 60 * 60,
    });
  }

  private setAdminMfaChallengeCookie(res: FastifyReply, challenge: string) {
    const secure = this.config.get('COOKIE_SECURE', false) === true || this.config.get('COOKIE_SECURE') === 'true';
    res.setCookie('admin_mfa_challenge', challenge, {
      httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/api/auth/admin-mfa', maxAge: 5 * 60,
    });
  }

  private clearAdminMfaChallengeCookie(res: FastifyReply) {
    const secure = this.config.get('COOKIE_SECURE', false) === true || this.config.get('COOKIE_SECURE') === 'true';
    res.clearCookie('admin_mfa_challenge', { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/api/auth/admin-mfa' });
  }
}
