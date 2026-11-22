import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { safeErrorLabel } from '../common/safe-error-label';

// Sends a one-time "your Pro trial is ending" email ~6h before expiry.
// Runs in-process (web dyno), so it works even though the BullMQ worker
// isn't deployed in production. The claim-before-send pattern makes it
// safe even if more than one scheduler instance ever runs.
@Injectable()
export class TrialService {
  private readonly log = new Logger(TrialService.name);
  private static readonly WINDOW_MS = 6 * 60 * 60 * 1000; // notify within 6h of expiry

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // Every 15 minutes.
  @Cron('*/15 * * * *', { name: 'trial-ending-reminder' })
  async sendTrialReminders() {
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + TrialService.WINDOW_MS);

      // Candidates: still trialing (ends in the future, within 6h),
      // not already upgraded to a paid tier, not already reminded.
      // An upgraded user has plan CREATOR/PRO/AGENCY; a trialing one is still FREE.
      const candidates = await this.prisma.user.findMany({
        where: {
          plan: 'FREE',
          trialReminderSent: false,
          trialEndsAt: { gt: now, lte: windowEnd },
        },
        select: { id: true, email: true, name: true, trialEndsAt: true },
      });

      if (candidates.length === 0) return;

      for (const u of candidates) {
        // Atomically claim this user so no second tick / instance double-sends.
        const claim = await this.prisma.user.updateMany({
          where: {
            id: u.id,
            plan: 'FREE',
            deletionRequestedAt: null,
            trialReminderSent: false,
            trialEndsAt: { gt: now, lte: windowEnd },
          },
          data: { trialReminderSent: true },
        });
        if (claim.count !== 1) continue; // someone else got it

        const hoursLeft = u.trialEndsAt
          ? (u.trialEndsAt.getTime() - Date.now()) / (60 * 60 * 1000)
          : 1;
        const sent = await this.mail.sendTrialEndingEmail(u.email, u.name, hoursLeft);
        if (!sent) {
          // The claim prevents duplicate mail, but restore it when delivery
          // fails so the next scheduler tick can retry instead of losing the
          // only reminder permanently.
          await this.prisma.user.updateMany({
            where: {
              id: u.id,
              plan: 'FREE',
              trialReminderSent: true,
              trialEndsAt: { gt: now, lte: windowEnd },
            },
            data: { trialReminderSent: false },
          });
          continue;
        }
        this.log.log(`Trial-ending reminder sent (${hoursLeft.toFixed(1)}h left)`);
      }
    } catch (e: unknown) {
      // Never let a scheduled run throw — just log and move on.
      this.log.warn(`trial reminder sweep failed (${safeErrorLabel(e)})`);
    }
  }
}
