import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { signupSchema, loginSchema } from './auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private auth: AuthService, private config: ConfigService) {}

  @Throttle({ default: { limit: 8, ttl: 60_000 } }) // brute-force protection
  @Post('signup')
  async signup(@Body() body: unknown, @Res({ passthrough: true }) res: FastifyReply) {
    const { name, email, password } = signupSchema.parse(body);
    const { user, accessToken, refreshToken } = await this.auth.signup(name, email, password);
    this.setCookies(res, accessToken, refreshToken);
    return { success: true, data: { user, accessToken } };
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } }) // brute-force protection
  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: FastifyReply) {
    const { email, password } = loginSchema.parse(body);
    const { user, accessToken, refreshToken } = await this.auth.login(email, password);
    this.setCookies(res, accessToken, refreshToken);
    return { success: true, data: { user, accessToken } };
  }

  @Post('refresh')
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const token = (req as any).cookies?.refresh_token;
    if (!token) throw new UnauthorizedException('No refresh token');
    const { accessToken, refreshToken } = await this.auth.refresh(token);
    this.setCookies(res, accessToken, refreshToken);
    return { success: true, data: { accessToken } };
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

  @Post('verify-otp')
  @UseGuards(JwtAuthGuard)
  async verifyOtp(@CurrentUser('userId') userId: string, @Body() body: { code: string }) {
    return this.auth.verifyOtp(userId, String(body?.code ?? ''));
  }

  @Post('resend-otp')
  @UseGuards(JwtAuthGuard)
  async resendOtp(@CurrentUser('userId') userId: string) {
    return this.auth.resendOtp(userId);
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
}
