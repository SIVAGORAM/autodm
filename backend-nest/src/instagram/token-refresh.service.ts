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
      const sent = await this.mail.sendBreakAlert(user.email, account.username, reason);
      if (sent) await this.prisma.igAccount.update({ where: { id: account.id }, data: { lastAlertAt: new Date() } });
    }
  }

  async refreshExpiring(withinDays = 7): Promise<{ checked: number; refreshed: number }> {
    const cutoff = new Date(Date.now() + withinDays * 86400000);
    const accounts = await this.prisma.igAccount.findMany({
      where: { isActive: true, loginMode: 'INSTAGRAM_LOGIN', tokenExpiresAt: { lte: cutoff }, user: { suspendedAt: null, deletionRequestedAt: null } },
    });
    const unifiedExpiring = await this.prisma.igAccount.findMany({
      where: { isActive: true, loginMode: 'UNIFIED_LOGIN', tokenExpiresAt: { lte: cutoff }, user: { suspendedAt: null, deletionRequestedAt: null } },
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
        const status = Number.isInteger(e?.response?.status) ? e.response.status : 'network';
        const rawCode = e?.response?.data?.error?.code;
        const code = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode))
          ? String(rawCode)
          : 'unknown';
        this.log.warn(`Token refresh failed status=${status} providerCode=${code}`);
        await this.alert(a, 'Instagram connection expired — reconnect to resume sending.');
      }
    }
    for (const a of unifiedExpiring) {
      await this.alert(a, 'Unified Instagram connection is nearing token expiry. Reconnect the account to keep automation running.');
    }
    if (accounts.length || unifiedExpiring.length) {
      this.log.log(`Token maintenance: ${refreshed}/${accounts.length} legacy tokens refreshed; ${unifiedExpiring.length} Unified Login token(s) need reconnection`);
    }
    return { checked: accounts.length + unifiedExpiring.length, refreshed };
  }
}
