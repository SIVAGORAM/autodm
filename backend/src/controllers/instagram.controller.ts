// src/controllers/instagram.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { encryption } from '../utils/encryption';
import { instagramService } from '../services/instagram.service';
import { AppError } from '../middlewares/errorHandler';
import { env } from '../configs/env';

export const instagramController = {
  // OAuth redirect URL
  async getAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const redirectUri = `${req.protocol}://${req.get('host')}/api/instagram/callback`;
      const scopes = ['instagram_basic', 'instagram_manage_comments', 'instagram_manage_messages', 'pages_show_list'].join(',');
      const url = `https://api.instagram.com/oauth/authorize?client_id=${env.INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;
      res.json({ success: true, data: { url } });
    } catch (err) { next(err); }
  },

  // OAuth callback - exchange code for token
  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.query;
      if (!code) throw new AppError('No authorization code', 400, 'MISSING_CODE');

      const redirectUri = `${req.protocol}://${req.get('host')}/api/instagram/callback`;
      const { accessToken, userId, username } = await instagramService.exchangeCodeForToken(code as string, redirectUri);

      const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

      await prisma.instagramAccount.upsert({
        where: { userId: req.user!.userId },
        update: {
          instagramUserId: userId,
          username,
          accessTokenEnc: encryption.encrypt(accessToken),
          tokenExpiresAt,
          isActive: true,
        },
        create: {
          userId: req.user!.userId,
          instagramUserId: userId,
          username,
          accessTokenEnc: encryption.encrypt(accessToken),
          tokenExpiresAt,
        },
      });

      res.redirect(`${env.CORS_ORIGIN}/dashboard/instagram?connected=true`);
    } catch (err) { next(err); }
  },

  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await prisma.instagramAccount.findUnique({
        where: { userId: req.user!.userId },
        select: { id: true, username: true, instagramUserId: true, isActive: true, tokenExpiresAt: true, createdAt: true },
      });
      res.json({ success: true, data: { account } });
    } catch (err) { next(err); }
  },

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      await prisma.instagramAccount.update({
        where: { userId: req.user!.userId },
        data: { isActive: false },
      });
      res.json({ success: true, message: 'Instagram account disconnected' });
    } catch (err) { next(err); }
  },

  async getMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await prisma.instagramAccount.findUnique({ where: { userId: req.user!.userId } });
      if (!account) throw new AppError('No Instagram account connected', 400, 'NO_IG_ACCOUNT');

      const media = await instagramService.getMedia(account.id);
      res.json({ success: true, data: { media } });
    } catch (err) { next(err); }
  },

  async addPostToCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const { campaignId, instagramPostId, mediaType, caption, permalink } = z.object({
        campaignId: z.string().uuid(),
        instagramPostId: z.string(),
        mediaType: z.string(),
        caption: z.string().optional(),
        permalink: z.string().optional(),
      }).parse(req.body);

      const account = await prisma.instagramAccount.findUnique({ where: { userId: req.user!.userId } });
      if (!account) throw new AppError('No Instagram account', 400, 'NO_IG_ACCOUNT');

      const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, instagramAccountId: account.id } });
      if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');

      const post = await prisma.post.upsert({
        where: { instagramPostId },
        update: { campaignId, isActive: true },
        create: { instagramAccountId: account.id, campaignId, instagramPostId, mediaType, caption, permalink },
      });

      res.json({ success: true, data: { post } });
    } catch (err) { next(err); }
  },
};
