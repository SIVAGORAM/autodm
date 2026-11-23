import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
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
    if (this.ig.unifiedTokenRefreshEnabled) {
      const groups = new Map<string, { token: string; rows: typeof unifiedExpiring }>();
      for (const account of unifiedExpiring) {
        try {
          const token = this.enc.decrypt(account.accessTokenEnc);
          const tokenFingerprint = createHash('sha256').update(token).digest('hex');
          const key = [account.userId, account.clientBusinessId ?? '', account.unifiedConfigId ?? '', tokenFingerprint].join(':');
          const group = groups.get(key) ?? { token, rows: [] };
          group.rows.push(account);
          groups.set(key, group);
        } catch {
          await this.alert(account, 'Unified Instagram connection needs attention. Reconnect to keep automation running.');
        }
      }

      for (const group of groups.values()) {
        const representative = group.rows[0];
        try {
          if (!representative.clientBusinessId || !representative.unifiedConfigId) {
            throw new Error('Unified token is missing its business/configuration binding');
          }
          const { accessToken, expiresInSec } = await this.ig.refreshUnifiedToken(group.token);
          if (expiresInSec !== null && (!Number.isFinite(expiresInSec) || expiresInSec <= 0)) {
            throw new Error('Meta returned an invalid refreshed token lifetime');
          }
          const expiresAt = expiresInSec === null ? null : new Date(Date.now() + expiresInSec * 1000);
          const updated = await this.prisma.igAccount.updateMany({
            where: {
              id: { in: group.rows.map((row) => row.id) },
              userId: representative.userId,
              isActive: true,
              loginMode: 'UNIFIED_LOGIN',
              accessTokenEnc: { in: group.rows.map((row) => row.accessTokenEnc) },
            },
            data: { accessTokenEnc: this.enc.encrypt(accessToken), tokenExpiresAt: expiresAt },
          });
          refreshed += updated.count;
        } catch (error: any) {
          const status = Number.isInteger(error?.response?.status) ? error.response.status : 'network';
          const rawCode = error?.response?.data?.error?.code;
          const code = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode))
            ? String(rawCode)
            : 'unknown';
          this.log.warn(`Unified token maintenance failed status=${status} providerCode=${code}`);
          for (const account of group.rows) {
            await this.alert(account, 'Unified Instagram connection is nearing token expiry. Reconnect the account to keep automation running.');
          }
        }
      }
    } else {
      for (const account of unifiedExpiring) {
        await this.alert(account, 'Unified Instagram connection is nearing token expiry. Reconnect the account to keep automation running.');
      }
    }
    if (accounts.length || unifiedExpiring.length) {
      this.log.log(`Token maintenance: ${refreshed}/${accounts.length} legacy account tokens refreshed; unifiedExpiring=${unifiedExpiring.length} unifiedRefreshEnabled=${this.ig.unifiedTokenRefreshEnabled}`);
    }
    return { checked: accounts.length + unifiedExpiring.length, refreshed };
  }
}
