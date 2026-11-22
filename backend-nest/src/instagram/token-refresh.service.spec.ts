import { TokenRefreshService } from './token-refresh.service';

describe('TokenRefreshService', () => {
  const legacy = {
    id: 'legacy-row', username: 'legacy.creator', userId: 'user-1', accessTokenEnc: 'encrypted-legacy',
    lastAlertAt: null, tokenExpiresAt: new Date(Date.now() + 60_000),
  };
  const unified = {
    id: 'unified-row', username: 'unified.creator', userId: 'user-2', accessTokenEnc: 'encrypted-unified',
    lastAlertAt: null, tokenExpiresAt: new Date(Date.now() + 60_000),
  };

  const prisma: any = {
    igAccount: { findMany: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const encryption: any = { decrypt: jest.fn(), encrypt: jest.fn() };
  const instagram: any = { refreshLongLivedToken: jest.fn() };
  const mail: any = { sendBreakAlert: jest.fn() };
  const service = new TokenRefreshService(prisma, encryption, instagram, mail);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.igAccount.findMany.mockResolvedValueOnce([legacy]).mockResolvedValueOnce([]);
    prisma.igAccount.update.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue({ email: 'creator@example.test' });
    encryption.decrypt.mockReturnValue('legacy-provider-token');
    encryption.encrypt.mockReturnValue('encrypted-refreshed-token');
    instagram.refreshLongLivedToken.mockResolvedValue({ accessToken: 'refreshed-provider-token', expiresInSec: 60 * 86400 });
    mail.sendBreakAlert.mockResolvedValue(true);
  });

  it('refreshes legacy Instagram Login tokens and persists the replacement encrypted', async () => {
    await expect(service.refreshExpiring()).resolves.toEqual({ checked: 1, refreshed: 1 });

    expect(instagram.refreshLongLivedToken).toHaveBeenCalledWith('legacy-provider-token');
    expect(encryption.encrypt).toHaveBeenCalledWith('refreshed-provider-token');
    expect(prisma.igAccount.update).toHaveBeenCalledWith({
      where: { id: legacy.id },
      data: { accessTokenEnc: 'encrypted-refreshed-token', tokenExpiresAt: expect.any(Date) },
    });
    expect(mail.sendBreakAlert).not.toHaveBeenCalled();
  });

  it('does not run the Instagram Login refresh endpoint for Unified Login tokens', async () => {
    prisma.igAccount.findMany.mockReset();
    prisma.igAccount.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([unified]);

    await expect(service.refreshExpiring()).resolves.toEqual({ checked: 1, refreshed: 0 });

    expect(instagram.refreshLongLivedToken).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: unified.userId }, select: { email: true } });
    expect(mail.sendBreakAlert).toHaveBeenCalledWith(
      'creator@example.test', unified.username,
      'Unified Instagram connection is nearing token expiry. Reconnect the account to keep automation running.',
    );
    expect(prisma.igAccount.update).toHaveBeenCalledWith({
      where: { id: unified.id }, data: { lastAlertAt: expect.any(Date) },
    });
  });
});
