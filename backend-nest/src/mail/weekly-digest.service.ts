import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { safeErrorLabel } from '../common/safe-error-label';

@Injectable()
export class WeeklyDigestService {
  private readonly log = new Logger(WeeklyDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // Run weekly digest every Monday at 9:00 AM UTC
  @Cron('0 9 * * 1', { name: 'weekly-celebration-email' })
  async sendWeeklyCelebrationSweep() {
    try {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const candidates = await this.prisma.user.findMany({
        where: {
          weeklyDigestEnabled: true,
          deletionRequestedAt: null,
          suspendedAt: null,
          OR: [
            { lastWeeklyDigestAt: null },
            { lastWeeklyDigestAt: { lt: sixDaysAgo } },
          ],
        },
        select: { id: true, email: true, name: true },
      });

      if (!candidates.length) return;

      this.log.log(`Starting weekly celebration email sweep for ${candidates.length} creators`);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      for (const user of candidates) {
        await this.sendDigestForUser(user.id, sevenDaysAgo);
      }
    } catch (err) {
      this.log.error(`Weekly celebration email sweep failed: ${safeErrorLabel(err)}`);
    }
  }

  async sendDigestForUser(userId: string, sinceDate?: Date): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, weeklyDigestEnabled: true },
    });
    if (!user || !user.weeklyDigestEnabled) return false;

    const since = sinceDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Atomically record send timestamp
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastWeeklyDigestAt: new Date() },
    });

    const [dmsSent, newFollowers, clicks, topAutomationRow] = await Promise.all([
      this.prisma.run.count({
        where: {
          automation: { igAccount: { userId } },
          status: 'SENT',
          createdAt: { gte: since },
        },
      }),
      this.prisma.contact.count({
        where: {
          igAccount: { userId },
          follows: true,
          lastInteraction: { gte: since },
        },
      }),
      this.prisma.click.count({
        where: {
          trackedLink: { automation: { igAccount: { userId } } },
          clickedAt: { gte: since },
        },
      }),
      this.prisma.automation.findFirst({
        where: { igAccount: { userId } },
        orderBy: { runs: { _count: 'desc' } },
        select: { name: true, _count: { select: { runs: true } } },
      }),
    ]);

    const clickRate = dmsSent > 0 ? Math.round((clicks / dmsSent) * 100) : 0;

    return this.mail.sendWeeklyCelebrationEmail(user.email, {
      creatorName: user.name || 'Creator',
      dmsSent,
      newFollowers,
      linkClicks: clicks,
      topAutomationName: topAutomationRow?.name ?? null,
      topAutomationClickRate: clickRate,
    });
  }
}
