import { BadRequestException, Controller, Delete, Get, Header, Param, Post, Query, Req, Res, UseGuards, Logger, UnauthorizedException, UnsupportedMediaTypeException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { InstagramService } from './instagram.service';
import type { InstagramLoginMode } from './instagram.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { safeErrorLabel } from '../common/safe-error-label';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../common/guards/verified-email.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { planFor } from '../common/plan.util';
import { Prisma } from '@prisma/client';
import { InstagramAccountLifecycleService } from './instagram-account-lifecycle.service';
import { metaScopedUserId, verifyMetaSignedRequest } from './meta-signed-request';
import { SkipThrottle } from '@nestjs/throttler';
import { DashboardEventsService } from '../queue/dashboard-events.service';

@Controller('api/instagram')
export class InstagramController {
  private readonly log = new Logger(InstagramController.name);
  constructor(
    private ig: InstagramService,
    private prisma: PrismaService,
    private enc: EncryptionService,
    private jwt: JwtService,
    private config: ConfigService,
    private readonly accountLifecycle: InstagramAccountLifecycleService,
    private readonly dashboardEvents: DashboardEventsService,
  ) {}

  // Signed, short-lived state ties the callback to the user and initiating browser.
  @Get('auth-url')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  async authUrl(@CurrentUser('userId') userId: string, @Query('mode') requestedMode: string, @Res({ passthrough: true }) res: FastifyReply) {
    if (requestedMode === 'UNIFIED_LOGIN' && !this.ig.unifiedLoginEnabled) {
      throw new BadRequestException('Unified Instagram Login is not enabled.');
    }
    const loginMode: InstagramLoginMode = requestedMode === 'UNIFIED_LOGIN' ? 'UNIFIED_LOGIN' : 'INSTAGRAM_LOGIN';
    const nonce = randomBytes(32).toString('base64url');
    const state = await this.jwt.signAsync(
      { sub: userId, nonce, loginMode },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '10m', audience: 'ig-oauth', issuer: 'autodm' },
    );
    const secure = this.config.get('COOKIE_SECURE', false) === true || this.config.get('COOKIE_SECURE') === 'true';
    // SameSite=Lax is sent on Instagram's top-level GET redirect back to this callback.
    // A state value copied from another browser will not have this nonce cookie.
    res.setCookie('ig_oauth_state', nonce, {
      httpOnly: true, secure, sameSite: 'lax', path: '/api/instagram/callback', maxAge: 10 * 60,
    });
    // If they already have an account linked, they're adding another — force the
    // IG login/account chooser so they can pick a different account (no Incognito).
    const existing = await this.prisma.igAccount.count({ where: { userId } });
    return { success: true, data: { url: this.ig.buildAuthUrl(state, existing > 0, loginMode), loginMode } };
  }

  @Get('login-options')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  loginOptions() {
    const publicUrl = this.config.getOrThrow<string>('PUBLIC_URL').trim().replace(/\/+$/, '');
    return {
      success: true,
      data: {
        unifiedLoginEnabled: this.ig.unifiedLoginEnabled,
        webhookCallbackUrl: `${publicUrl}/webhooks/instagram`,
      },
    };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: any,
    @Res() res: FastifyReply,
  ) {
    const frontend = this.config.get('CORS_ORIGIN', 'http://localhost:3000').split(',')[0];
    const stateCookie = req.cookies?.ig_oauth_state;
    const secure = this.config.get('COOKIE_SECURE', false) === true || this.config.get('COOKIE_SECURE') === 'true';
    res.clearCookie('ig_oauth_state', { path: '/api/instagram/callback', secure, sameSite: 'lax' });
    try {
      if (error) throw new BadRequestException(error);
      if (!code || !state) throw new BadRequestException('Missing code or state');

      let userId: string;
      let loginMode: InstagramLoginMode;
      try {
        const payload: any = await this.jwt.verifyAsync(state, {
          secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), audience: 'ig-oauth', issuer: 'autodm',
        });
        if (typeof payload.sub !== 'string' || typeof payload.nonce !== 'string' || typeof stateCookie !== 'string') {
          throw new Error('Invalid OAuth state binding');
        }
        if (payload.loginMode !== 'INSTAGRAM_LOGIN' && payload.loginMode !== 'UNIFIED_LOGIN') throw new Error('Invalid login mode');
        loginMode = payload.loginMode;
        const expected = createHash('sha256').update(payload.nonce).digest();
        const actual = createHash('sha256').update(stateCookie).digest();
        if (!timingSafeEqual(expected, actual)) throw new Error('Invalid OAuth state binding');
        userId = payload.sub;
      } catch {
        throw new BadRequestException('Invalid or expired state');
      }
      if (loginMode === 'UNIFIED_LOGIN' && !this.ig.unifiedLoginEnabled) {
        throw new BadRequestException('Unified Instagram Login is no longer enabled. Restart the connection using the available login method.');
      }

      const initiatingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isVerified: true, deletionRequestedAt: true },
      });
      if (!initiatingUser?.isVerified || initiatingUser.deletionRequestedAt) {
        throw new BadRequestException('This account is unavailable. Sign in again and restart Instagram connection.');
      }

      const { accessToken, igUserId, username, expiresInSec, clientBusinessId, unifiedConfigId, accounts: grantedAccounts } = await this.ig.exchangeCodeForToken(code, loginMode);
      const accounts = grantedAccounts?.length ? grantedAccounts : [{ igUserId, username }];
      const accountIds = new Set(accounts.map((account) => account.igUserId));
      if (accountIds.size !== accounts.length || accounts.some((account) => !account.igUserId || !account.username)) {
        throw new BadRequestException('Meta returned an invalid Instagram account list. Restart the connection and try again.');
      }
      const tokenExpiresAt = expiresInSec ? new Date(Date.now() + expiresInSec * 1000) : null;

      // Serialize link callbacks for this user so concurrent OAuth windows
      // cannot both pass the account-cap check and exceed the plan limit.
      let linked = false;
      for (let attempt = 0; attempt < 3 && !linked; attempt++) {
        try {
          await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
              where: { id: userId },
              select: { isVerified: true, deletionRequestedAt: true, plan: true, planExpiresAt: true, trialEndsAt: true },
            });
            if (!user?.isVerified || user.deletionRequestedAt) {
              throw new BadRequestException('This account is unavailable. Sign in again and restart Instagram connection.');
            }

            const existingAccounts = await Promise.all(accounts.map((account) =>
              tx.igAccount.findUnique({ where: { igUserId: account.igUserId } }),
            ));
            let newActiveAccounts = 0;
            existingAccounts.forEach((existing) => {
              if (existing && existing.userId !== userId) {
                throw new BadRequestException('An Instagram account in this Meta grant is already linked to another user.');
              }
              if (existing && existing.loginMode !== loginMode) {
                throw new BadRequestException('An Instagram account in this Meta grant is connected through a different Meta login. Disconnect it before reconnecting with the new login method.');
              }
              if (!existing || !existing.isActive) newActiveAccounts++;
            });
            const cap = planFor(user).accountCap;
            const count = await tx.igAccount.count({ where: { userId, isActive: true } });
            if (count + newActiveAccounts > cap) throw new BadRequestException(`Your plan allows ${cap} connected account(s)`);

            for (const account of accounts) {
              await tx.igAccount.upsert({
                where: { igUserId: account.igUserId },
                update: { username: account.username, accessTokenEnc: this.enc.encrypt(accessToken), tokenExpiresAt, loginMode, clientBusinessId, unifiedConfigId, isActive: true },
                create: { userId, igUserId: account.igUserId, username: account.username, accessTokenEnc: this.enc.encrypt(accessToken), tokenExpiresAt, loginMode, clientBusinessId, unifiedConfigId },
              });
            }
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
          linked = true;
        } catch (error: any) {
          if (error?.code === 'P2034' && attempt < 2) continue;
          throw error;
        }
      }

      let webhookError = false;
      for (const account of accounts) {
        await this.prisma.igAccount.updateMany({
          where: { userId, igUserId: account.igUserId, isActive: true },
          data: { webhookSubscribedAt: null },
        });
        try {
          await this.ig.subscribeToWebhooks(account.igUserId, accessToken, loginMode);
          await this.prisma.igAccount.updateMany({
            where: { userId, igUserId: account.igUserId, isActive: true },
            data: { webhookSubscribedAt: new Date() },
          });
        } catch {
          webhookError = true;
          this.log.warn('Instagram account connected without confirmed comments/messages webhook subscription');
        }
      }

      void this.dashboardEvents.publish(userId, 'instagram');
      return res.redirect(`${frontend}/dashboard/instagram?connected=1${webhookError ? '&webhook_error=1' : ''}`, 302);
    } catch (e: unknown) {
      this.log.warn(`IG callback failed (${safeErrorLabel(e)})`);
      // The user sees a clean, friendly message — never raw internals.
      const friendly = 'We couldn\'t connect your Instagram account. Please try again, and make sure it\'s a professional (Business or Creator) account.';
      return res.redirect(`${frontend}/dashboard/instagram?error=${encodeURIComponent(friendly)}`, 302);
    }
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  async accounts(@CurrentUser('userId') userId: string) {
    const accounts = await this.prisma.igAccount.findMany({
      where: { userId },
      select: { id: true, username: true, igUserId: true, isActive: true, tokenExpiresAt: true, webhookSubscribedAt: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const webhookEvents = accounts.length
      ? await this.prisma.webhookEvent.groupBy({
        by: ['igAccountId'],
        where: { igAccountId: { in: accounts.map((account) => account.id) } },
        _max: { createdAt: true },
      })
      : [];
    const lastWebhookAtByAccount = new Map(
      webhookEvents.map((event) => [event.igAccountId, event._max.createdAt?.toISOString() ?? null]),
    );
    return {
      success: true,
      data: accounts.map((account) => ({
        ...account,
        lastWebhookAt: lastWebhookAtByAccount.get(account.id) ?? null,
      })),
    };
  }

  @Get('accounts/:id/media')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  async media(@CurrentUser('userId') userId: string, @Param('id') id: string, @Query('after') after?: string) {
    if (after !== undefined && (typeof after !== 'string' || !after.trim() || after.length > 2048)) {
      throw new BadRequestException('The media page cursor is invalid. Reload recent posts and try again.');
    }
    const acc = await this.prisma.igAccount.findUnique({ where: { id } });
    if (!acc || acc.userId !== userId) throw new BadRequestException('Account not found');
    const token = this.enc.decrypt(acc.accessTokenEnc);
    return { success: true, data: await this.ig.getMedia(token, acc.igUserId, acc.loginMode, after?.trim()) };
  }

  @Post('accounts/:id/webhooks/subscribe')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  async subscribeWebhooks(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const account = await this.prisma.igAccount.findUnique({ where: { id } });
    if (!account || account.userId !== userId || !account.isActive) throw new BadRequestException('Active Instagram account not found.');
    const token = this.enc.decrypt(account.accessTokenEnc);
    await this.ig.subscribeToWebhooks(account.igUserId, token, account.loginMode);
    await this.prisma.igAccount.update({ where: { id }, data: { webhookSubscribedAt: new Date() } });
    void this.dashboardEvents.publish(userId, 'instagram');
    return { success: true, data: { webhookSubscribed: true } };
  }

  @Delete('accounts/:id')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  async disconnect(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    const result = await this.accountLifecycle.disconnect(userId, id);
    void this.dashboardEvents.publish(userId, 'instagram');
    return result;
  }

  @Post('deauthorize')
  @SkipThrottle()
  @Header('Cache-Control', 'no-store')
  async deauthorize(@Req() request: FastifyRequest) {
    const signedRequest = this.readMetaSignedRequest(request, 'deauthorization');
    const claims = verifyMetaSignedRequest(signedRequest, this.config.get('META_APP_SECRET', ''));
    const igUserId = claims && metaScopedUserId(claims);
    if (!igUserId) throw new UnauthorizedException('Invalid Meta deauthorization signature.');

    // The receipt makes provider retries idempotent, including if the creator
    // reconnects before Meta retries an older callback.
    const requestHash = createHash('sha256').update(signedRequest).digest('hex');
    return this.accountLifecycle.deauthorizeInstagramUser(igUserId, requestHash);
  }

  @Post('data-deletion')
  @SkipThrottle()
  @Header('Cache-Control', 'no-store')
  async dataDeletion(@Req() request: FastifyRequest) {
    const signedRequest = this.readMetaSignedRequest(request, 'data-deletion');
    const claims = verifyMetaSignedRequest(signedRequest, this.config.get('META_APP_SECRET', ''));
    const igUserId = claims && metaScopedUserId(claims);
    if (!igUserId) throw new UnauthorizedException('Invalid Meta data-deletion signature.');

    const requestHash = createHash('sha256').update(signedRequest).digest('hex');
    const confirmationCode = await this.accountLifecycle.deleteInstagramData(igUserId, requestHash);
    const publicUrl = this.config.getOrThrow<string>('PUBLIC_URL').trim().replace(/\/+$/, '');
    return {
      url: `${publicUrl}/api/instagram/data-deletion/status?code=${encodeURIComponent(confirmationCode)}`,
      confirmation_code: confirmationCode,
    };
  }

  @Get('data-deletion/status')
  @SkipThrottle()
  @Header('Cache-Control', 'no-store')
  async dataDeletionStatus(@Query('code') code: string) {
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(code)) {
      throw new NotFoundException('Data deletion status not found.');
    }
    const status = await this.accountLifecycle.metaDataDeletionStatus(code);
    if (status.status !== 'completed') throw new NotFoundException('Data deletion status not found.');
    return status;
  }

  private readMetaSignedRequest(request: FastifyRequest, callbackName: string) {
    const contentType = String(request.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/x-www-form-urlencoded') {
      throw new UnsupportedMediaTypeException('Expected a signed Meta form callback.');
    }
    if (typeof request.body !== 'string' || request.body.length > 16 * 1024) {
      throw new BadRequestException(`Invalid Meta ${callbackName} callback.`);
    }
    const signedRequests = new URLSearchParams(request.body).getAll('signed_request');
    if (signedRequests.length !== 1) throw new UnauthorizedException(`Invalid Meta ${callbackName} signature.`);
    return signedRequests[0];
  }
}
