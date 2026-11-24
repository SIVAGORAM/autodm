import { InstagramController } from './instagram.controller';
import { createHash, createHmac } from 'node:crypto';

describe('InstagramController OAuth callback binding', () => {
  const nonce = 'browser-bound-random-nonce';
  const prisma = {
    user: { findUnique: jest.fn() },
    igAccount: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
    webhookEvent: { groupBy: jest.fn() },
    $transaction: jest.fn(),
  };
  const userTx = {
    user: { findUnique: jest.fn() },
    automation: { updateMany: jest.fn() },
    igAccount: { findUnique: jest.fn(), count: jest.fn(), upsert: jest.fn(), updateMany: jest.fn() },
  };
  const ig = { buildAuthUrl: jest.fn(), exchangeCodeForToken: jest.fn(), subscribeToWebhooks: jest.fn(), getMedia: jest.fn() };
  const enc = { encrypt: jest.fn((value: string) => `encrypted:${value}`), decrypt: jest.fn((value: string) => `decrypted:${value}`) };
  const jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => key === 'COOKIE_SECURE' ? false : key === 'META_APP_SECRET' ? 'test-secret' : fallback),
    getOrThrow: jest.fn((key: string) => key === 'PUBLIC_URL' ? 'https://api.example.test/' : 'test-secret'),
  };
  const lifecycle = {
    disconnect: jest.fn(),
    deauthorizeInstagramUser: jest.fn(),
    deleteInstagramData: jest.fn(),
    metaDataDeletionStatus: jest.fn(),
  };
  const dashboardEvents = { publish: jest.fn().mockResolvedValue(undefined) };
  let controller: InstagramController;
  let reply: { setCookie: jest.Mock; clearCookie: jest.Mock; redirect: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string, fallback?: unknown) => key === 'COOKIE_SECURE' ? false : key === 'META_APP_SECRET' ? 'test-secret' : fallback);
    (ig as any).oauthRedirectUri = 'http://localhost:3000/api/instagram/callback';
    prisma.user.findUnique.mockResolvedValue({ isVerified: true, deletionRequestedAt: null });
    prisma.igAccount.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation((callback: (tx: typeof userTx) => unknown) => callback(userTx));
    userTx.user.findUnique.mockResolvedValue({
      isVerified: true, deletionRequestedAt: null, plan: 'FREE', planExpiresAt: null, trialEndsAt: null,
    });
    userTx.igAccount.findUnique.mockResolvedValue(null);
    userTx.igAccount.count.mockResolvedValue(0);
    userTx.igAccount.upsert.mockResolvedValue({ id: 'account-1' });
    prisma.igAccount.updateMany.mockResolvedValue({ count: 1 });
    prisma.webhookEvent.groupBy.mockResolvedValue([]);
    ig.exchangeCodeForToken.mockResolvedValue({
      accessToken: 'provider-token', igUserId: 'ig-user-1', username: 'creator', expiresInSec: 3600,
    });
    jwt.signAsync.mockResolvedValue('signed-state');
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', nonce, loginMode: 'INSTAGRAM_LOGIN' });
    lifecycle.disconnect.mockResolvedValue({ success: true });
    lifecycle.deauthorizeInstagramUser.mockResolvedValue({ success: true });
    lifecycle.deleteInstagramData.mockResolvedValue('A'.repeat(32));
    lifecycle.metaDataDeletionStatus.mockResolvedValue({ status: 'completed' });
    ig.subscribeToWebhooks.mockResolvedValue(undefined);
    reply = { setCookie: jest.fn(), clearCookie: jest.fn(), redirect: jest.fn() };
    controller = new InstagramController(ig as any, prisma as any, enc as any, jwt as any, config as any, lifecycle as any, dashboardEvents as any);
  });

  it('binds signed OAuth state to a short-lived HTTP-only browser cookie', async () => {
    await controller.authUrl('user-1', undefined as any, { protocol: 'http', headers: { 'x-forwarded-proto': 'https' } } as any, reply as any);

    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1', nonce: expect.any(String) }),
      expect.objectContaining({ audience: 'ig-oauth', issuer: 'autodm', expiresIn: '10m' }),
    );
    expect(reply.setCookie).toHaveBeenCalledWith('ig_oauth_state', expect.any(String), expect.objectContaining({
      httpOnly: true, secure: true, sameSite: 'lax', path: '/api/instagram/callback', maxAge: 600,
    }));
  });

  it('keeps legacy Instagram Login as the default when Unified Login is enabled', async () => {
    (ig as any).unifiedLoginEnabled = true;

    await controller.authUrl('user-1', undefined as any, { protocol: 'http', headers: {} } as any, reply as any);

    expect(ig.buildAuthUrl).toHaveBeenCalledWith(expect.any(String), false, 'INSTAGRAM_LOGIN');
  });

  it('exposes Unified Login as available only when its backend feature flag is enabled', () => {
    (ig as any).unifiedLoginEnabled = false;
    (ig as any).instagramLoginAppId = 'instagram-app-id';
    (ig as any).instagramLoginUsesMetaFallback = false;
    (ig as any).unifiedLoginAppId = 'meta-app-id';
    (ig as any).unifiedLoginConfigId = 'business-config-id';
    (ig as any).oauthRedirectUri = 'https://app.example.test/api/instagram/callback';
    expect(controller.loginOptions()).toEqual({
      success: true,
      data: {
        unifiedLoginEnabled: false,
        instagramLoginAppId: 'instagram-app-id',
        instagramLoginUsesMetaFallback: false,
        unifiedLoginAppId: 'meta-app-id',
        unifiedLoginConfigId: 'business-config-id',
        oauthRedirectUri: 'https://app.example.test/api/instagram/callback',
        webhookCallbackUrl: 'https://api.example.test/webhooks/instagram',
      },
    });
    (ig as any).unifiedLoginEnabled = true;
    expect(controller.loginOptions()).toEqual({
      success: true,
      data: {
        unifiedLoginEnabled: true,
        instagramLoginAppId: 'instagram-app-id',
        instagramLoginUsesMetaFallback: false,
        unifiedLoginAppId: 'meta-app-id',
        unifiedLoginConfigId: 'business-config-id',
        oauthRedirectUri: 'https://app.example.test/api/instagram/callback',
        webhookCallbackUrl: 'https://api.example.test/webhooks/instagram',
      },
    });
  });

  it('reports the latest received webhook timestamp without exposing event payloads', async () => {
    const createdAt = new Date('2026-11-22T13:00:00.000Z');
    prisma.igAccount.findMany = jest.fn().mockResolvedValue([
      { id: 'account-1', username: 'creator', igUserId: 'ig-user-1', isActive: true, webhookSubscribedAt: createdAt, createdAt },
    ]);
    prisma.webhookEvent.groupBy.mockResolvedValue([{ igAccountId: 'account-1', _max: { createdAt } }]);

    const result = await controller.accounts('user-1');

    expect(prisma.webhookEvent.groupBy).toHaveBeenCalledWith({
      by: ['igAccountId'],
      where: { igAccountId: { in: ['account-1'] } },
      _max: { createdAt: true },
    });
    expect(prisma.igAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ loginMode: true }),
    }));
    expect(result.data).toEqual([expect.objectContaining({ lastWebhookAt: createdAt.toISOString() })]);
    expect(JSON.stringify(result)).not.toContain('payload');
  });

  it('does not query webhook events when a user has no connected accounts', async () => {
    prisma.igAccount.findMany = jest.fn().mockResolvedValue([]);

    const result = await controller.accounts('user-1');

    expect(result.data).toEqual([]);
    expect(prisma.webhookEvent.groupBy).not.toHaveBeenCalled();
  });

  it('paginates media only after confirming the Instagram account belongs to the caller', async () => {
    prisma.igAccount.findUnique.mockResolvedValue({
      id: 'account-1', userId: 'user-1', igUserId: 'ig-user-1', accessTokenEnc: 'ciphertext', loginMode: 'INSTAGRAM_LOGIN',
    });
    ig.getMedia.mockResolvedValue({ media: [{ id: 'older-reel', media_type: 'VIDEO' }], nextCursor: null });

    await expect(controller.media('user-1', 'account-1', 'opaque-cursor')).resolves.toEqual({
      success: true, data: { media: [{ id: 'older-reel', media_type: 'VIDEO' }], nextCursor: null },
    });
    expect(ig.getMedia).toHaveBeenCalledWith('decrypted:ciphertext', 'ig-user-1', 'INSTAGRAM_LOGIN', 'opaque-cursor');
  });

  it('does not fetch media for another user or accept oversized cursors', async () => {
    prisma.igAccount.findUnique.mockResolvedValue({ id: 'account-1', userId: 'another-user' });
    await expect(controller.media('user-1', 'account-1')).rejects.toThrow('Account not found');
    expect(ig.getMedia).not.toHaveBeenCalled();

    await expect(controller.media('user-1', 'account-1', 'x'.repeat(2049))).rejects.toThrow('The media page cursor is invalid.');
  });

  it('rejects an explicit Unified Login authorization request while the feature flag is disabled', async () => {
    (ig as any).unifiedLoginEnabled = false;

    await expect(controller.authUrl('user-1', 'UNIFIED_LOGIN', { protocol: 'http', headers: {} } as any, reply as any))
      .rejects.toThrow('Unified Instagram Login is not enabled.');
    expect(ig.buildAuthUrl).not.toHaveBeenCalled();
  });

  it('allows an explicit Unified Login authorization request only after the feature flag is enabled', async () => {
    (ig as any).unifiedLoginEnabled = true;

    await controller.authUrl('user-1', 'UNIFIED_LOGIN', { protocol: 'http', headers: {} } as any, reply as any);

    expect(ig.buildAuthUrl).toHaveBeenCalledWith(expect.any(String), false, 'UNIFIED_LOGIN');
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ loginMode: 'UNIFIED_LOGIN' }), expect.any(Object));
  });

  it('does not complete a Unified Login callback after the feature flag is turned off', async () => {
    (ig as any).unifiedLoginEnabled = false;
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', nonce, loginMode: 'UNIFIED_LOGIN' });

    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: nonce } }, reply as any);

    expect(ig.exchangeCodeForToken).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(reply.redirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard/instagram?error='), 302);
  });

  it('rejects a state token returned from a browser without the matching cookie', async () => {
    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: 'another-browser' } }, reply as any);

    expect(ig.exchangeCodeForToken).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(reply.clearCookie).toHaveBeenCalledWith('ig_oauth_state', expect.objectContaining({ path: '/api/instagram/callback' }));
    expect(reply.redirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard/instagram?error='), 302);
  });

  it('logs only normalized provider error fields when Meta returns an OAuth denial', async () => {
    const warn = jest.spyOn((controller as any).log, 'warn').mockImplementation(() => undefined);

    await controller.callback('', '', 'access_denied', {
      query: { error_code: '190', error_description: 'sensitive provider details must not be logged' },
      cookies: {},
    }, reply as any);

    expect(warn).toHaveBeenCalledWith('Meta Instagram OAuth returned error=access_denied code=190');
    expect(warn).toHaveBeenCalledWith('IG callback failed stage=provider_callback (BadRequestException)');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('sensitive provider details');
    expect(ig.exchangeCodeForToken).not.toHaveBeenCalled();
    expect(reply.redirect).toHaveBeenCalledWith('http://localhost:3000/dashboard/instagram?error=cancelled', 302);
  });

  it('returns OAuth results to the configured callback frontend when several preview origins are allowed', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'COOKIE_SECURE') return false;
      if (key === 'CORS_ORIGIN') return 'https://heylaunch.app,https://frontend-fawn-six-26.vercel.app';
      if (key === 'META_APP_SECRET') return 'test-secret';
      return fallback;
    });
    (ig as any).oauthRedirectUri = 'https://frontend-fawn-six-26.vercel.app/api/instagram/callback';

    await controller.callback('', '', 'access_denied', {
      query: { error_code: '190' },
      cookies: {},
    }, reply as any);

    expect(reply.redirect).toHaveBeenCalledWith(
      'https://frontend-fawn-six-26.vercel.app/dashboard/instagram?error=cancelled', 302,
    );
  });

  it('records the failed OAuth callback stage without logging exception contents', async () => {
    const warn = jest.spyOn((controller as any).log, 'warn').mockImplementation(() => undefined);
    ig.exchangeCodeForToken.mockRejectedValueOnce(new Error('provider response contained a private token'));

    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: nonce } }, reply as any);

    expect(warn).toHaveBeenCalledWith('IG callback failed stage=code_exchange (Error)');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private token');
    expect(reply.redirect).toHaveBeenCalledWith('http://localhost:3000/dashboard/instagram?error=connect_failed', 302);
  });

  it('clears the OAuth state cookie with the Secure flag behind an HTTPS-terminating proxy', async () => {
    await controller.callback('', '', '', {
      protocol: 'http',
      headers: { 'x-forwarded-proto': 'https' },
      cookies: {},
    }, reply as any);

    expect(reply.clearCookie).toHaveBeenCalledWith('ig_oauth_state', expect.objectContaining({
      path: '/api/instagram/callback', secure: true, sameSite: 'lax',
    }));
  });

  it('does not link an Instagram account after the initiating account is deletion-locked', async () => {
    userTx.user.findUnique.mockResolvedValueOnce({
      isVerified: true, deletionRequestedAt: new Date(), plan: 'FREE', planExpiresAt: null, trialEndsAt: null,
    });

    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: nonce } }, reply as any);

    expect(ig.exchangeCodeForToken).toHaveBeenCalledWith('oauth-code', 'INSTAGRAM_LOGIN');
    expect(prisma.igAccount.upsert).not.toHaveBeenCalled();
    expect(reply.redirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard/instagram?error='), 302);
  });

  it('rejects an OAuth flow that was started before account deletion', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ isVerified: true, deletionRequestedAt: new Date() });

    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: nonce } }, reply as any);

    expect(ig.exchangeCodeForToken).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.igAccount.upsert).not.toHaveBeenCalled();
  });

  it('subscribes the connected professional account to comments and messages after OAuth linking', async () => {
    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: nonce } }, reply as any);

    expect(ig.subscribeToWebhooks).toHaveBeenCalledWith('ig-user-1', 'provider-token', 'INSTAGRAM_LOGIN');
    expect(prisma.igAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', igUserId: 'ig-user-1', isActive: true },
      data: { webhookSubscribedAt: expect.any(Date), webhookFields: ['comments', 'messages'] },
    });
    expect(reply.redirect).toHaveBeenCalledWith('http://localhost:3000/dashboard/instagram?connected=1', 302);
    expect(dashboardEvents.publish).toHaveBeenCalledWith('user-1', 'instagram');
  });

  it('stores a Unified Login account with encrypted token and its login metadata without changing account ownership', async () => {
    (ig as any).unifiedLoginEnabled = true;
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', nonce, loginMode: 'UNIFIED_LOGIN' });
    ig.exchangeCodeForToken.mockResolvedValueOnce({
      accessToken: 'unified-provider-token', igUserId: 'ig-user-1', username: 'creator', expiresInSec: null,
      loginMode: 'UNIFIED_LOGIN', clientBusinessId: 'client-business', unifiedConfigId: 'config-id',
    });

    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: nonce } }, reply as any);

    expect(userTx.igAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { igUserId: 'ig-user-1' },
      update: expect.objectContaining({ accessTokenEnc: 'encrypted:unified-provider-token', loginMode: 'UNIFIED_LOGIN', clientBusinessId: 'client-business', unifiedConfigId: 'config-id' }),
      create: expect.objectContaining({ userId: 'user-1', igUserId: 'ig-user-1', loginMode: 'UNIFIED_LOGIN' }),
    }));
    expect(ig.subscribeToWebhooks).toHaveBeenCalledWith('ig-user-1', 'unified-provider-token', 'UNIFIED_LOGIN');
    expect(reply.redirect).toHaveBeenCalledWith('http://localhost:3000/dashboard/instagram?connected=1', 302);
  });

  it('links every account in a Unified Login grant within the plan cap and subscribes each account', async () => {
    (ig as any).unifiedLoginEnabled = true;
    userTx.user.findUnique.mockResolvedValueOnce({
      isVerified: true, deletionRequestedAt: null, plan: 'PRO', planExpiresAt: null, trialEndsAt: null,
    });
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', nonce, loginMode: 'UNIFIED_LOGIN' });
    ig.exchangeCodeForToken.mockResolvedValueOnce({
      accessToken: 'shared-provider-token', igUserId: 'ig-user-1', username: 'creator-one', expiresInSec: 3600,
      loginMode: 'UNIFIED_LOGIN', clientBusinessId: 'client-business', unifiedConfigId: 'config-id',
      accounts: [{ igUserId: 'ig-user-1', username: 'creator-one' }, { igUserId: 'ig-user-2', username: 'creator-two' }],
    });

    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: nonce } }, reply as any);

    expect(userTx.igAccount.upsert).toHaveBeenCalledTimes(2);
    expect(ig.subscribeToWebhooks).toHaveBeenNthCalledWith(1, 'ig-user-1', 'shared-provider-token', 'UNIFIED_LOGIN');
    expect(ig.subscribeToWebhooks).toHaveBeenNthCalledWith(2, 'ig-user-2', 'shared-provider-token', 'UNIFIED_LOGIN');
    expect(reply.redirect).toHaveBeenCalledWith('http://localhost:3000/dashboard/instagram?connected=1', 302);
  });

  it('rejects a multi-account grant atomically when its accounts exceed the plan cap', async () => {
    (ig as any).unifiedLoginEnabled = true;
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', nonce, loginMode: 'UNIFIED_LOGIN' });
    ig.exchangeCodeForToken.mockResolvedValueOnce({
      accessToken: 'shared-provider-token', igUserId: 'ig-user-1', username: 'creator-one', expiresInSec: 3600,
      loginMode: 'UNIFIED_LOGIN', clientBusinessId: 'client-business', unifiedConfigId: 'config-id',
      accounts: [{ igUserId: 'ig-user-1', username: 'creator-one' }, { igUserId: 'ig-user-2', username: 'creator-two' }],
    });

    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: nonce } }, reply as any);

    expect(userTx.igAccount.upsert).not.toHaveBeenCalled();
    expect(ig.subscribeToWebhooks).not.toHaveBeenCalled();
    expect(reply.redirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard/instagram?error='), 302);
  });

  it('keeps the account linked but marks webhook setup as needing attention if Meta rejects subscription', async () => {
    ig.subscribeToWebhooks.mockRejectedValueOnce(new Error('safe subscription failure'));

    await controller.callback('oauth-code', 'signed-state', '', { cookies: { ig_oauth_state: nonce } }, reply as any);

    expect(userTx.igAccount.upsert).toHaveBeenCalled();
    expect(prisma.igAccount.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', igUserId: 'ig-user-1', isActive: true },
      data: { webhookSubscribedAt: null, webhookFields: [] },
    });
    expect(reply.redirect).toHaveBeenCalledWith('http://localhost:3000/dashboard/instagram?connected=1&webhook_error=1', 302);
  });

  it('delegates disconnect to the queue-aware account lifecycle service', async () => {
    await expect(controller.disconnect('user-1', 'account-1')).resolves.toEqual({ success: true });
    expect(lifecycle.disconnect).toHaveBeenCalledWith('user-1', 'account-1');
    expect(dashboardEvents.publish).toHaveBeenCalledWith('user-1', 'instagram');
  });

  it('accepts Meta deauthorization only after signed_request verification', async () => {
    const payload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '123456789', issued_at: Math.floor(Date.now() / 1000) })).toString('base64url');
    const signature = createHmac('sha256', 'test-secret').update(payload).digest('base64url');
    const request = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ signed_request: `${signature}.${payload}` }).toString(),
    };

    await expect(controller.deauthorize(request as any)).resolves.toEqual({ success: true });
    const signedRequest = new URLSearchParams(request.body).get('signed_request')!;
    expect(lifecycle.deauthorizeInstagramUser).toHaveBeenCalledWith(
      '123456789', createHash('sha256').update(signedRequest).digest('hex'),
    );
  });

  it('rejects malformed or unsigned Meta deauthorization requests', async () => {
    await expect(controller.deauthorize({
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ signed_request: 'not-signed' }).toString(),
    } as any)).rejects.toThrow('Invalid Meta deauthorization signature.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(lifecycle.deauthorizeInstagramUser).not.toHaveBeenCalled();
  });

  it('returns a public completion URL after verified Instagram data is purged', async () => {
    const payload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '123456789', issued_at: Math.floor(Date.now() / 1000) })).toString('base64url');
    const signature = createHmac('sha256', 'test-secret').update(payload).digest('base64url');
    const signedRequest = `${signature}.${payload}`;
    const request = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ signed_request: signedRequest }).toString(),
    };

    await expect(controller.dataDeletion(request as any)).resolves.toEqual({
      url: `https://api.example.test/api/instagram/data-deletion/status?code=${'A'.repeat(32)}`,
      confirmation_code: 'A'.repeat(32),
    });
    expect(lifecycle.deleteInstagramData).toHaveBeenCalledWith('123456789', expect.any(String));
    expect(lifecycle.deleteInstagramData.mock.invocationCallOrder[0])
      .toBeLessThan(config.getOrThrow.mock.invocationCallOrder[0]);
  });

  it('returns only the completion state for a valid deletion receipt code', async () => {
    await expect(controller.dataDeletionStatus('A'.repeat(32))).resolves.toEqual({ status: 'completed' });
    expect(lifecycle.metaDataDeletionStatus).toHaveBeenCalledWith('A'.repeat(32));
  });
});
