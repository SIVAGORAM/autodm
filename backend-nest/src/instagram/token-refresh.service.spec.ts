import { TokenRefreshService } from './token-refresh.service';

describe('TokenRefreshService', () => {
  const legacy = {
    id: 'legacy-row', username: 'legacy.creator', userId: 'user-1', accessTokenEnc: 'encrypted-legacy',
    lastAlertAt: null, tokenExpiresAt: new Date(Date.now() + 60_000),
  };
  const unified = {
    id: 'unified-row', username: 'unified.creator', userId: 'user-2', accessTokenEnc: 'encrypted-unified',
    clientBusinessId: '123456', unifiedConfigId: 'config-1', loginMode: 'UNIFIED_LOGIN', isActive: true,
    lastAlertAt: null, tokenExpiresAt: new Date(Date.now() + 60_000),
  };

  const prisma: any = {
    igAccount: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const encryption: any = { decrypt: jest.fn(), encrypt: jest.fn() };
  const instagram: any = {
    unifiedTokenRefreshEnabled: false,
    refreshLongLivedToken: jest.fn(),
    refreshUnifiedToken: jest.fn(),
  };
  const mail: any = { sendBreakAlert: jest.fn() };
  const service = new TokenRefreshService(prisma, encryption, instagram, mail);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.igAccount.findMany.mockResolvedValueOnce([legacy]).mockResolvedValueOnce([]);
    prisma.igAccount.update.mockResolvedValue({});
    prisma.igAccount.updateMany.mockResolvedValue({ count: 0 });
    prisma.user.findUnique.mockResolvedValue({ email: 'creator@example.test' });
    encryption.decrypt.mockReturnValue('legacy-provider-token');
    encryption.encrypt.mockReturnValue('encrypted-refreshed-token');
    instagram.refreshLongLivedToken.mockResolvedValue({ accessToken: 'refreshed-provider-token', expiresInSec: 60 * 86400 });
    instagram.refreshUnifiedToken.mockResolvedValue({ accessToken: 'refreshed-bisu-token', expiresInSec: 60 * 86400 });
    instagram.unifiedTokenRefreshEnabled = false;
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

  it('refreshes one shared Unified Login grant once and atomically updates its linked accounts', async () => {
    const secondAccount = {
      ...unified, id: 'unified-row-2', username: 'second.creator', accessTokenEnc: 'encrypted-unified-2',
    };
    prisma.igAccount.findMany.mockReset();
    prisma.igAccount.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([unified, secondAccount]);
    prisma.igAccount.updateMany.mockResolvedValueOnce({ count: 2 });
    encryption.decrypt.mockReturnValue('current-bisu-token');
    encryption.encrypt.mockReturnValue('encrypted-refreshed-bisu-token');
    instagram.unifiedTokenRefreshEnabled = true;

    await expect(service.refreshExpiring()).resolves.toEqual({ checked: 2, refreshed: 2 });

    expect(instagram.refreshUnifiedToken).toHaveBeenCalledTimes(1);
    expect(instagram.refreshUnifiedToken).toHaveBeenCalledWith('current-bisu-token');
    expect(prisma.igAccount.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [unified.id, secondAccount.id] }, userId: unified.userId, isActive: true,
        loginMode: 'UNIFIED_LOGIN', accessTokenEnc: { in: [unified.accessTokenEnc, secondAccount.accessTokenEnc] },
      },
      data: { accessTokenEnc: 'encrypted-refreshed-bisu-token', tokenExpiresAt: expect.any(Date) },
    });
    expect(mail.sendBreakAlert).not.toHaveBeenCalled();
  });
});
