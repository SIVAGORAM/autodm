// src/controllers/dashboard.controller.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const dashboardController = {
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await prisma.instagramAccount.findUnique({
        where: { userId: req.user!.userId },
        select: { id: true },
      });

      if (!account) {
        return res.json({
          success: true,
          data: {
            stats: { totalSent: 0, conversionRate: '0%', activeThreads: 0, queueStatus: 'Idle' },
            recentLogs: []
          }
        });
      }

      const [totalComments, dmsSent, recentLogs] = await Promise.all([
        prisma.commentEvent.count({ where: { campaign: { instagramAccountId: account.id } } }),
        prisma.commentEvent.count({ where: { campaign: { instagramAccountId: account.id }, status: 'DM_SENT' } }),
        prisma.dmLog.findMany({
          where: { instagramAccountId: account.id },
          orderBy: { sentAt: 'desc' },
          take: 10,
          select: { recipientUsername: true, status: true, sentAt: true, message: true },
        })
      ]);

      const conversionRate = totalComments > 0 ? ((dmsSent / totalComments) * 100).toFixed(1) + '%' : '0%';

      res.json({
        success: true,
        data: {
          stats: {
            totalSent: dmsSent,
            conversionRate,
            activeThreads: dmsSent, // Mock tracking or exact count of unique logs
            queueStatus: 'Active'
          },
          recentLogs
        }
      });
    } catch (err) { next(err); }
  }
};
