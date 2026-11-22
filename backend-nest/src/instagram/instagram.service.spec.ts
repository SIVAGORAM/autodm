import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { InstagramService } from './instagram.service';

describe('InstagramService Unified Login', () => {
  const config = {
    get: jest.fn((key: string) => ({
      META_GRAPH_VERSION: 'v26.0',
      META_UNIFIED_LOGIN_ENABLED: true,
      META_UNIFIED_LOGIN_CONFIG_ID: 'business-config-id',
    } as Record<string, unknown>)[key]),
    getOrThrow: jest.fn((key: string) => ({
      META_APP_ID: 'app-id',
      META_APP_SECRET: 'app-secret',
      PUBLIC_URL: 'https://api.example.test/',
    } as Record<string, string>)[key]),
  };

  afterEach(() => jest.restoreAllMocks());

  it('preserves the existing Instagram Login authorization flow and scopes', () => {
    const service = new InstagramService(config as any);
    const url = new URL(service.buildAuthUrl('signed-state', true, 'INSTAGRAM_LOGIN'));

    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('app-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.example.test/api/instagram/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments');
    expect(url.searchParams.get('force_reauth')).toBe('true');
  });

  it('preserves legacy code exchange, long-lived token exchange, and account lookup', async () => {
    const get = jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { access_token: 'long-lived-token', expires_in: 5_184_000 } } as any)
      .mockResolvedValueOnce({ data: { user_id: 'ig-user-id', username: 'creator' } } as any);
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'short-lived-token', user_id: 12345 } } as any);
    const service = new InstagramService(config as any);

    await expect(service.exchangeCodeForToken('oauth-code', 'INSTAGRAM_LOGIN')).resolves.toEqual({
      accessToken: 'long-lived-token', igUserId: '12345', username: 'creator', expiresInSec: 5_184_000,
      loginMode: 'INSTAGRAM_LOGIN', clientBusinessId: null, unifiedConfigId: null,
    });
    expect(post).toHaveBeenCalledWith('https://api.instagram.com/oauth/access_token', expect.any(URLSearchParams), expect.objectContaining({ timeout: 15_000 }));
    expect(get).toHaveBeenNthCalledWith(1, 'https://graph.instagram.com/access_token', expect.objectContaining({
      params: expect.objectContaining({ grant_type: 'ig_exchange_token', access_token: 'short-lived-token' }),
    }));
    expect(get).toHaveBeenNthCalledWith(2, 'https://graph.instagram.com/me', expect.objectContaining({
      params: expect.objectContaining({ fields: 'user_id,username', access_token: 'long-lived-token' }),
    }));
  });

  it('builds a Facebook Login for Business URL without exposing tokens', () => {
    const service = new InstagramService(config as any);
    const url = new URL(service.buildAuthUrl('signed-state', false, 'UNIFIED_LOGIN'));

    expect(url.origin + url.pathname).toBe('https://www.facebook.com/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('app-id');
    expect(url.searchParams.get('config_id')).toBe('business-config-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://api.example.test/api/instagram/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('override_default_response_type')).toBe('true');
    expect(url.searchParams.has('scope')).toBe(false);
    expect(url.searchParams.get('prompt')).toBe('login');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.has('access_token')).toBe(false);
  });

  it('does not build or invoke Unified Login when the feature flag is disabled', () => {
    const disabledConfig = {
      ...config,
      get: jest.fn((key: string) => key === 'META_UNIFIED_LOGIN_ENABLED' ? false : config.get(key)),
    };
    const service = new InstagramService(disabledConfig as any);

    expect(service.unifiedLoginEnabled).toBe(false);
    expect(() => service.buildAuthUrl('signed-state', false, 'UNIFIED_LOGIN')).toThrow('Unified Instagram Login is not configured.');
  });

  it('exchanges a Unified Login code for one assigned professional account', async () => {
    const get = jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { access_token: 'bis-token', expires_in: 7200 } } as any)
      .mockResolvedValueOnce({ data: { client_business_id: 'business-id' } } as any)
      .mockResolvedValueOnce({ data: { data: [{ id: 'ig-id', username: 'creator' }] } } as any);
    const service = new InstagramService(config as any);

    await expect(service.exchangeCodeForToken('oauth-code', 'UNIFIED_LOGIN')).resolves.toEqual({
      accessToken: 'bis-token', igUserId: 'ig-id', username: 'creator', expiresInSec: 7200,
      loginMode: 'UNIFIED_LOGIN', clientBusinessId: 'business-id', unifiedConfigId: 'business-config-id',
      accounts: [{ igUserId: 'ig-id', username: 'creator' }],
    });
    expect(get).toHaveBeenNthCalledWith(1, 'https://graph.facebook.com/v26.0/oauth/access_token', expect.objectContaining({
      params: expect.objectContaining({ client_id: 'app-id', code: 'oauth-code', redirect_uri: 'https://api.example.test/api/instagram/callback' }),
    }));
    expect(get).toHaveBeenNthCalledWith(3, 'https://graph.facebook.com/v26.0/me/assigned_instagram_accounts', expect.objectContaining({
      params: expect.objectContaining({ fields: 'id,username', limit: 100, access_token: 'bis-token' }),
    }));
  });

  it('returns all assigned Instagram accounts from a Unified Login grant', async () => {
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { access_token: 'bis-token' } } as any)
      .mockResolvedValueOnce({ data: { client_business_id: 'business-id' } } as any)
      .mockResolvedValueOnce({ data: { data: [{ id: 'ig-1', username: 'one' }, { id: 'ig-2', username: 'two' }] } } as any);
    const service = new InstagramService(config as any);

    await expect(service.exchangeCodeForToken('oauth-code', 'UNIFIED_LOGIN')).resolves.toMatchObject({
      igUserId: 'ig-1', username: 'one',
      accounts: [{ igUserId: 'ig-1', username: 'one' }, { igUserId: 'ig-2', username: 'two' }],
    });
  });

  it('rejects an incomplete assigned-account result instead of silently truncating it', async () => {
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { access_token: 'bis-token' } } as any)
      .mockResolvedValueOnce({ data: { client_business_id: 'business-id' } } as any)
      .mockResolvedValueOnce({ data: { data: [{ id: 'ig-1', username: 'one' }], paging: { next: 'https://graph.facebook.com/next' } } } as any);
    const service = new InstagramService(config as any);

    await expect(service.exchangeCodeForToken('oauth-code', 'UNIFIED_LOGIN'))
      .rejects.toThrow(new BadRequestException('Unified Login did not return a complete list of Instagram professional accounts.'));
  });

  it('does not persist a Unified Login grant without its required business portfolio ID', async () => {
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { access_token: 'bis-token' } } as any)
      .mockResolvedValueOnce({ data: {} } as any);
    const service = new InstagramService(config as any);

    await expect(service.exchangeCodeForToken('oauth-code', 'UNIFIED_LOGIN'))
      .rejects.toThrow(new BadRequestException('Meta did not return the business portfolio for this connection.'));
  });

  it('loads media from the account-scoped Facebook Graph endpoint', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: {
      data: [{ id: 'reel-id', media_type: 'VIDEO' }],
      paging: { cursors: { after: 'opaque-cursor' }, next: 'https://graph.facebook.com/ignored-next-url' },
    } } as any);
    const service = new InstagramService(config as any);

    await expect(service.getMedia('bis-token', 'ig-id', 'UNIFIED_LOGIN')).resolves.toEqual({
      media: [{ id: 'reel-id', media_type: 'VIDEO' }], nextCursor: 'opaque-cursor',
    });
    expect(get).toHaveBeenCalledWith('https://graph.facebook.com/v26.0/ig-id/media', expect.objectContaining({
      params: expect.objectContaining({ fields: 'id,media_type,caption,permalink,timestamp', access_token: 'bis-token' }),
    }));
  });

  it('preserves the legacy media field request without adding Facebook-login-only fields', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: [] } } as any);
    const service = new InstagramService(config as any);

    await service.getMedia('legacy-token', 'ig-id', 'INSTAGRAM_LOGIN');

    expect(get).toHaveBeenCalledWith('https://graph.instagram.com/v26.0/me/media', expect.objectContaining({
      params: expect.objectContaining({ fields: 'id,media_type,caption,permalink,timestamp', access_token: 'legacy-token' }),
      proxy: false,
    }));
  });

  it('logs a safe transport code when Meta media loading fails before an HTTP response', async () => {
    const service = new InstagramService(config as any);
    const warn = jest.spyOn((service as any).log, 'warn').mockImplementation(() => undefined);
    jest.spyOn(axios, 'get').mockRejectedValue(Object.assign(new Error('request failed with secret-bearing config'), {
      code: 'ECONNRESET',
      config: { params: { access_token: 'must-not-be-logged' } },
    }));

    await expect(service.getMedia('provider-token', 'ig-id', 'INSTAGRAM_LOGIN'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('status=network providerCode=unknown transportCode=ECONNRESET'));
    expect(warn.mock.calls.flat().join(' ')).not.toContain('must-not-be-logged');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('provider-token');
  });

  it('requests the next media page with the opaque cursor on the fixed Graph endpoint', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: {
      data: [{ id: 'older-reel', media_type: 'VIDEO' }],
      paging: { cursors: { after: 'next-cursor' } },
    } } as any);
    const service = new InstagramService(config as any);

    await expect(service.getMedia('legacy-token', 'ig-id', 'INSTAGRAM_LOGIN', 'opaque-after-cursor')).resolves.toEqual({
      media: [{ id: 'older-reel', media_type: 'VIDEO' }], nextCursor: null,
    });
    expect(get).toHaveBeenCalledWith('https://graph.instagram.com/v26.0/me/media', expect.objectContaining({
      params: expect.objectContaining({ after: 'opaque-after-cursor', access_token: 'legacy-token' }),
      timeout: 15_000,
    }));
  });

  it('does not expose a cursor when Meta has no next-page URL', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data: { data: [{ id: 'last', media_type: 'IMAGE' }], paging: { cursors: { after: 'ignored' } } } } as any);
    const service = new InstagramService(config as any);
    await expect(service.getMedia('legacy-token', 'ig-id', 'INSTAGRAM_LOGIN')).resolves.toEqual({
      media: [{ id: 'last', media_type: 'IMAGE' }], nextCursor: null,
    });
  });

  it.each([
    ['INSTAGRAM_LOGIN', 'https://graph.instagram.com/v26.0/media-id'],
    ['UNIFIED_LOGIN', 'https://graph.facebook.com/v26.0/media-id'],
  ] as const)('reads selected media metadata through the %s Graph host', async (loginMode, endpoint) => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ data: { id: 'media-id', media_type: 'CAROUSEL_ALBUM', owner: { id: 'ig-owner' } } } as any);
    const service = new InstagramService(config as any);

    await expect(service.getMediaMetadata('provider-token', 'media-id', loginMode)).resolves.toEqual({
      id: 'media-id', media_type: 'CAROUSEL_ALBUM', ownerId: 'ig-owner',
    });
    expect(get).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      params: { fields: 'id,media_type,owner', access_token: 'provider-token' }, timeout: 15_000,
    }));
  });

  it('does not accept metadata for a different media ID', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data: { id: 'another-media', media_type: 'IMAGE' } } as any);
    const service = new InstagramService(config as any);

    await expect(service.getMediaMetadata('provider-token', 'media-id', 'INSTAGRAM_LOGIN'))
      .rejects.toThrow('Could not verify this Instagram post');
  });
});
