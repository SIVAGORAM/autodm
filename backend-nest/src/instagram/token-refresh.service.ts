import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';
import { InstagramService } from './instagram.service';
import { MailService } from '../mail/mail.service';

// Refreshes Instagram long-lived tokens before they expire (~60 days).
// Run daily from the worker. Without this, every account dies at 60 days.
@Injectable()
export class TokenRefreshService {
  private readonly log = new Logger(TokenRefreshService.name);
  constructor(
    private prisma: PrismaService,
    private enc: EncryptionService,
    private ig: InstagramService,
    private mail: MailService,
  ) {}

  private async alert(account: { id: string; username: string; userId: string; lastAlertAt: Date | null }, reason: string) {
    // At most one alert per account per 24h.
    if (account.lastAlertAt && Date.now() - account.lastAlertAt.getTime() < 86400000) return;
    const user = await this.prisma.user.findUnique({ where: { id: account.userId }, select: { email: true } });
    if (user?.email) {
      await this.mail.sendBreakAlert(user.email, account.username, reason);
      await this.prisma.igAccount.update({ where: { id: account.id }, data: { lastAlertAt: new Date() } });
    }
  }

  async refreshExpiring(withinDays = 7): Promise<{ checked: number; refreshed: number }> {
    const cutoff = new Date(Date.now() + withinDays * 86400000);
    const accounts = await this.prisma.igAccount.findMany({
      where: { isActive: true, tokenExpiresAt: { lte: cutoff } },
    });
    let refreshed = 0;
    for (const a of accounts) {
      try {
        const current = this.enc.decrypt(a.accessTokenEnc);
        const { accessToken, expiresInSec } = await this.ig.refreshLongLivedToken(current);
        await this.prisma.igAccount.update({
          where: { id: a.id },
          data: { accessTokenEnc: this.enc.encrypt(accessToken), tokenExpiresAt: new Date(Date.now() + expiresInSec * 1000) },
        });
        refreshed++;
      } catch (e: any) {
        this.log.warn(`Token refresh failed for @${a.username}: ${e?.response?.data?.error?.message ?? e.message}`);
        await this.alert(a, 'Instagram connection expired — reconnect to resume sending.');
      }
    }
    if (accounts.length) this.log.log(`Token refresh: ${refreshed}/${accounts.length} refreshed`);
    return { checked: accounts.length, refreshed };
  }
}
