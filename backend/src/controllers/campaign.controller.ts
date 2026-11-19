// src/controllers/campaign.controller.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  messageTemplate: z.string().min(1).max(1000),
  requireFollower: z.boolean().default(true),
  keywords: z.array(z.string()).max(20).default([]),
  dailyLimit: z.number().int().min(1).max(500).default(200),
});

const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
});

export const campaignController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createCampaignSchema.parse(req.body);

      let account = await prisma.instagramAccount.findUnique({
        where: { userId: req.user!.userId },
      });
      
      if (!account && process.env.NODE_ENV === 'development') {
        account = await prisma.instagramAccount.create({
          data: {
            userId: req.user!.userId,
            instagramUserId: `mock_${Date.now()}`,
            username: 'dev_tester_ig',
            accessTokenEnc: 'mock_token',
          }
        });
      } else if (!account) {
        throw new AppError('Connect Instagram account first', 400, 'NO_IG_ACCOUNT');
      }

      // Check subscription campaign limit
      const subscription = await prisma.subscription.findUnique({
        where: { userId: req.user!.userId },
        include: { plan: true },
      });

      const existingCount = await prisma.campaign.count({
        where: { instagramAccountId: account.id },
      });

      const limit = subscription?.plan?.campaignLimit ?? 1; // Free: 1 campaign
      if (existingCount >= limit) {
        throw new AppError(`Campaign limit (${limit}) reached. Upgrade your plan.`, 403, 'CAMPAIGN_LIMIT');
      }

      const campaign = await prisma.campaign.create({
        data: { ...data, instagramAccountId: account.id },
      });

      res.status(201).json({ success: true, data: { campaign } });
    } catch (err) { next(err); }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await prisma.instagramAccount.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!account) { res.json({ success: true, data: { campaigns: [] } }); return; }

      const campaigns = await prisma.campaign.findMany({
        where: { instagramAccountId: account.id },
        include: {
          _count: { select: { commentEvents: true } },
          posts: { select: { id: true, instagramPostId: true, mediaType: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: { campaigns } });
    } catch (err) { next(err); }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const account = await prisma.instagramAccount.findUnique({ where: { userId: req.user!.userId } });

      const campaign = await prisma.campaign.findFirst({
        where: { id, instagramAccountId: account?.id },
        include: {
          posts: true,
          automationRules: true,
          _count: { select: { commentEvents: true } },
        },
      });

      if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
      res.json({ success: true, data: { campaign } });
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateCampaignSchema.parse(req.body);

      const account = await prisma.instagramAccount.findUnique({ where: { userId: req.user!.userId } });
      const campaign = await prisma.campaign.findFirst({ where: { id, instagramAccountId: account?.id } });
      if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');

      const updated = await prisma.campaign.update({ where: { id }, data });
      res.json({ success: true, data: { campaign: updated } });
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const account = await prisma.instagramAccount.findUnique({ where: { userId: req.user!.userId } });
      const campaign = await prisma.campaign.findFirst({ where: { id, instagramAccountId: account?.id } });
      if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');

      await prisma.campaign.delete({ where: { id } });
      res.json({ success: true, message: 'Campaign deleted' });
    } catch (err) { next(err); }
  },

  async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { days = '7' } = req.query;
      const daysNum = Math.min(parseInt(days as string) || 7, 90);
      const since = new Date(Date.now() - daysNum * 86400 * 1000);

      const account = await prisma.instagramAccount.findUnique({ where: { userId: req.user!.userId } });
      const campaign = await prisma.campaign.findFirst({ where: { id, instagramAccountId: account?.id } });
      if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');

      const [totalComments, dmsSent, dmsSkipped, dmsFailed, recentDms] = await Promise.all([
        prisma.commentEvent.count({ where: { campaignId: id, createdAt: { gte: since } } }),
        prisma.commentEvent.count({ where: { campaignId: id, status: 'DM_SENT', createdAt: { gte: since } } }),
        prisma.commentEvent.count({ where: { campaignId: id, status: 'SKIPPED', createdAt: { gte: since } } }),
        prisma.commentEvent.count({ where: { campaignId: id, status: 'FAILED', createdAt: { gte: since } } }),
        prisma.dmLog.findMany({
          where: { commentEvent: { campaignId: id }, sentAt: { gte: since } },
          orderBy: { sentAt: 'desc' },
          take: 50,
          select: { recipientUsername: true, status: true, sentAt: true, message: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          stats: { totalComments, dmsSent, dmsSkipped, dmsFailed, conversionRate: totalComments > 0 ? (dmsSent / totalComments * 100).toFixed(1) : '0' },
          recentDms,
        },
      });
    } catch (err) { next(err); }
  },
};
