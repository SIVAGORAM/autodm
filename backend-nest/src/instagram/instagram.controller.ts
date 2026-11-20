import { BadRequestException, Controller, Delete, Get, Param, Query, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FastifyReply } from 'fastify';
import { InstagramService } from './instagram.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { planFor } from '../common/plan.util';

@Controller('api/instagram')
export class InstagramController {
  private readonly log = new Logger(InstagramController.name);
  constructor(
    private ig: InstagramService,
    private prisma: PrismaService,
    private enc: EncryptionService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // Signed, short-lived state ties the callback back to this user without a cookie.
  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  async authUrl(@CurrentUser('userId') userId: string) {
    const state = await this.jwt.signAsync(
      { sub: userId },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '10m', audience: 'ig-oauth', issuer: 'autodm' },
    );
    // If they already have an account linked, they're adding another — force the
    // IG login/account chooser so they can pick a different account (no Incognito).
    const existing = await this.prisma.igAccount.count({ where: { userId } });
    return { success: true, data: { url: this.ig.buildAuthUrl(state, existing > 0) } };
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Res() res: FastifyReply) {
    const frontend = this.config.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
    try {
      if (error) throw new BadRequestException(error);
      if (!code || !state) throw new BadRequestException('Missing code or state');

      let userId: string;
      try {
        const payload: any = await this.jwt.verifyAsync(state, {
          secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), audience: 'ig-oauth', issuer: 'autodm',
        });
        userId = payload.sub;
      } catch {
        throw new BadRequestException('Invalid or expired state');
      }

      const { accessToken, igUserId, username, expiresInSec } = await this.ig.exchangeCodeForToken(code);
      const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000);

      const existing = await this.prisma.igAccount.findUnique({ where: { igUserId } });
      if (existing && existing.userId !== userId) {
        throw new BadRequestException('This Instagram account is already linked to another user');
      }

      if (!existing) {
        // Enforce the plan cap on NEW links.
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true, trialEndsAt: true } });
        const cap = planFor(user).accountCap;
        const count = await this.prisma.igAccount.count({ where: { userId, isActive: true } });
        if (count >= cap) throw new BadRequestException(`Your plan allows ${cap} connected account(s)`);
      }

      await this.prisma.igAccount.upsert({
        where: { igUserId },
        update: { username, accessTokenEnc: this.enc.encrypt(accessToken), tokenExpiresAt, isActive: true },
        create: { userId, igUserId, username, accessTokenEnc: this.enc.encrypt(accessToken), tokenExpiresAt },
      });

      return res.redirect(`${frontend}/dashboard/instagram?connected=1`, 302);
    } catch (e: any) {
      // Full technical detail stays in server logs only.
      this.log.warn(`IG callback failed: ${e.message}`);
      // The user sees a clean, friendly message — never raw internals.
      const friendly = 'We couldn\'t connect your Instagram account. Please try again, and make sure it\'s a professional (Business or Creator) account.';
      return res.redirect(`${frontend}/dashboard/instagram?error=${encodeURIComponent(friendly)}`, 302);
    }
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  async accounts(@CurrentUser('userId') userId: string) {
    const accounts = await this.prisma.igAccount.findMany({
      where: { userId },
      select: { id: true, username: true, igUserId: true, isActive: true, tokenExpiresAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, data: accounts };
  }

  @Get('accounts/:id/media')
  @UseGuards(JwtAuthGuard)
  async media(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const acc = await this.prisma.igAccount.findUnique({ where: { id } });
    if (!acc || acc.userId !== userId) throw new BadRequestException('Account not found');
    const token = this.enc.decrypt(acc.accessTokenEnc);
    return { success: true, data: await this.ig.getMedia(token) };
  }

  @Delete('accounts/:id')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const acc = await this.prisma.igAccount.findUnique({ where: { id } });
    if (!acc || acc.userId !== userId) throw new BadRequestException('Account not found');
    await this.prisma.igAccount.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
