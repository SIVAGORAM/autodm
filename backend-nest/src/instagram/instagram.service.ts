import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { metaHttpOptions } from '../common/meta-http';

export interface IgTokenResult {
  accessToken: string;
  igUserId: string;
  username: string;
  expiresInSec: number | null;
  loginMode: 'INSTAGRAM_LOGIN' | 'UNIFIED_LOGIN';
  clientBusinessId: string | null;
  unifiedConfigId: string | null;
  // Unified Login can grant multiple assigned professional accounts using one
  // business integration token. Legacy Login continues to return one account.
  accounts?: Array<{ igUserId: string; username: string }>;
}

export type InstagramLoginMode = IgTokenResult['loginMode'];

// Instagram Login API (graph.instagram.com) — matches MetaService.
// Flow: code -> short-lived token -> long-lived (60d) token -> profile.
@Injectable()
export class InstagramService {
  private readonly log = new Logger(InstagramService.name);
  constructor(private config: ConfigService) {}

  private get httpOptions() { return metaHttpOptions(this.config.get<string>('META_HTTPS_PROXY')); }

  async subscribeToWebhooks(igUserId: string, token: string, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN'): Promise<string[]> {
    const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
    const host = loginMode === 'UNIFIED_LOGIN' ? 'graph.facebook.com' : 'graph.instagram.com';
    const subscribedFields = this.liveCommentsEnabled ? ['comments', 'messages', 'live_comments'] : ['comments', 'messages'];
    try {
      await axios.post(`https://${host}/${version}/${encodeURIComponent(igUserId)}/subscribed_apps`, null, {
        params: { subscribed_fields: subscribedFields.join(','), access_token: token },
        timeout: 15_000,
        ...this.httpOptions,
      });
      return subscribedFields;
    } catch (err: any) {
      const status = Number.isInteger(err?.response?.status) ? err.response.status : 'network';
      const rawCode = err?.response?.data?.error?.code ?? err?.response?.data?.code;
      const code = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode))
        ? String(rawCode)
        : 'unknown';
      this.log.warn(`Instagram webhook subscription failed status=${status} providerCode=${code}`);
      if (status === 'network') {
        throw new ServiceUnavailableException('Could not reach Meta to confirm webhook setup. Check the backend outbound connection and retry.');
      }
      const safeCode = code === 'unknown' ? '' : `, code ${code}`;
      throw new BadRequestException(`Meta rejected webhook setup (HTTP ${status}${safeCode}). Check the app-level webhook fields, granted permissions, and account eligibility.`);
    }
  }

  private get appId() { return this.config.getOrThrow<string>('META_APP_ID'); }
  private get appSecret() { return this.config.getOrThrow<string>('META_APP_SECRET'); }
  // Instagram Business Login has its own app credentials. Fall back to the
  // historical shared variables so existing deployments keep working until
  // the Instagram product credentials are entered separately.
  private get instagramAppId() { return this.config.get<string>('INSTAGRAM_APP_ID')?.trim() || this.appId; }
  private get instagramAppSecret() { return this.config.get<string>('INSTAGRAM_APP_SECRET')?.trim() || this.appSecret; }
  get unifiedLoginEnabled() { return this.config.get<boolean>('META_UNIFIED_LOGIN_ENABLED') === true || this.config.get('META_UNIFIED_LOGIN_ENABLED') === 'true'; }
  get unifiedTokenRefreshEnabled() { return this.config.get<boolean>('META_UNIFIED_TOKEN_REFRESH_ENABLED') === true || this.config.get('META_UNIFIED_TOKEN_REFRESH_ENABLED') === 'true'; }
  get liveCommentsEnabled() { return this.config.get<boolean>('META_LIVE_COMMENTS_ENABLED') === true || this.config.get('META_LIVE_COMMENTS_ENABLED') === 'true'; }
  private get unifiedConfigId() { return this.config.get<string>('META_UNIFIED_LOGIN_CONFIG_ID') ?? ''; }
  // These identifiers are public OAuth parameters, not credentials. Exposing
  // them to the authenticated setup panel helps operators match the deployed
  // backend to the Meta app/configuration without revealing either secret.
  get instagramLoginAppId() { return this.config.get<string>('INSTAGRAM_APP_ID')?.trim() || this.config.get<string>('META_APP_ID')?.trim() || ''; }
  get instagramLoginUsesMetaFallback() { return !this.config.get<string>('INSTAGRAM_APP_ID')?.trim(); }
  get unifiedLoginAppId() { return this.config.get<string>('META_APP_ID')?.trim() || ''; }
  get unifiedLoginConfigId() { return this.unifiedConfigId; }
  private get redirectUri() {
    const configured = this.config.get<string>('INSTAGRAM_OAUTH_REDIRECT_URI')?.trim();
    if (configured) return configured.replace(/\/+$/, '');

    // OAuth starts through the frontend's same-origin /api proxy. Send Meta
    // back through that same host so the browser-bound OAuth state cookie is
    // sent to the callback and can be validated.
    const frontendOrigin = this.config.get<string>('CORS_ORIGIN')?.split(',')[0]?.trim();
    if (frontendOrigin) {
      try {
        const origin = new URL(frontendOrigin);
        if (origin.protocol === 'http:' || origin.protocol === 'https:') {
          return `${origin.origin}/api/instagram/callback`;
        }
      } catch { /* use the API-origin fallback for legacy local configurations */ }
    }
    return `${this.config.getOrThrow<string>('PUBLIC_URL').trim().replace(/\/+$/, '')}/api/instagram/callback`;
  }

  get oauthRedirectUri() { return this.redirectUri; }

  buildAuthUrl(state: string, forceReauth = false, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN'): string {
    if (loginMode === 'UNIFIED_LOGIN') {
      if (!this.unifiedLoginEnabled || !this.unifiedConfigId.trim()) throw new BadRequestException('Unified Instagram Login is not configured.');
      const p = new URLSearchParams({
        client_id: this.appId,
        config_id: this.unifiedConfigId,
        display: 'popup',
        redirect_uri: this.redirectUri,
        response_type: 'code',
        // This configuration uses a Business Integration System User token.
        // Meta requires this override so the config's default response types
        // do not replace the authorization-code flow used by our callback.
        override_default_response_type: 'true',
        prompt: 'login',
        state,
      });
      return `https://www.facebook.com/dialog/oauth?${p.toString()}`;
    }
    const scopes = [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
    ].join(',');
    const p = new URLSearchParams({
      client_id: this.instagramAppId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      state,
    });
    // When adding a DIFFERENT account, force Instagram to show the login/account
    // chooser instead of silently reusing the browser's current IG session.
    if (forceReauth) p.set('force_reauth', 'true');
    return `https://www.instagram.com/oauth/authorize?${p.toString()}`;
  }

  async exchangeCodeForToken(code: string, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN'): Promise<IgTokenResult> {
   if (loginMode === 'UNIFIED_LOGIN') return this.exchangeUnifiedCode(code);
   try {
    // 1. code -> short-lived token
    const form = new URLSearchParams({
      client_id: this.instagramAppId,
      client_secret: this.instagramAppSecret,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
      code,
    });
    const shortRes = await axios.post('https://api.instagram.com/oauth/access_token', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15_000,
      ...this.httpOptions,
    });
    const shortToken: string = shortRes.data.access_token;
    const igUserId: string = String(shortRes.data.user_id);

    // 2. short -> long-lived (≈60 days)
    const longRes = await axios.get('https://graph.instagram.com/access_token', {
      // Use the same Instagram product credentials that issued the short-lived
      // token. META_APP_SECRET may belong to the separate Facebook Login app.
      params: { grant_type: 'ig_exchange_token', client_secret: this.instagramAppSecret, access_token: shortToken },
      timeout: 15_000,
      ...this.httpOptions,
    });
    const longToken: string = longRes.data.access_token;
    const expiresInSec: number = longRes.data.expires_in ?? 60 * 24 * 60 * 60;

    // 3. profile
    const me = await axios.get('https://graph.instagram.com/me', {
      params: { fields: 'user_id,username', access_token: longToken },
      timeout: 15_000,
      ...this.httpOptions,
    });

    return { accessToken: longToken, igUserId, username: me.data.username, expiresInSec, loginMode, clientBusinessId: null, unifiedConfigId: null };
   } catch (err: any) {
     const status = Number.isInteger(err?.response?.status) ? err.response.status : 'network';
     const rawCode = err?.response?.data?.error?.code ?? err?.response?.data?.code;
     const providerCode = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode))
       ? String(rawCode)
       : 'unknown';
     this.log.warn(`IG OAuth exchange failed status=${status} providerCode=${providerCode}`);
     throw new Error('Instagram OAuth exchange failed');
   }
  }

  private async exchangeUnifiedCode(code: string): Promise<IgTokenResult> {
    try {
      const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
      const tokenRes = await axios.get(`https://graph.facebook.com/${version}/oauth/access_token`, {
        params: { client_id: this.appId, client_secret: this.appSecret, code, redirect_uri: this.redirectUri },
        timeout: 15_000,
        ...this.httpOptions,
      });
      const accessToken: string = tokenRes.data.access_token;
      if (typeof accessToken !== 'string' || !accessToken) throw new Error('Missing Unified Login token');
      const me = await axios.get(`https://graph.facebook.com/${version}/me`, {
        params: { fields: 'client_business_id', access_token: accessToken }, timeout: 15_000,
        ...this.httpOptions,
      });
      const clientBusinessId = me.data?.client_business_id;
      if (typeof clientBusinessId !== 'string' || !clientBusinessId) {
        throw new BadRequestException('Meta did not return the business portfolio for this connection.');
      }
      const accounts = await axios.get(`https://graph.facebook.com/${version}/me/assigned_instagram_accounts`, {
        params: { fields: 'id,username', limit: 100, access_token: accessToken }, timeout: 15_000,
        ...this.httpOptions,
      });
      const assigned = Array.isArray(accounts.data?.data) ? accounts.data.data : [];
      if (!assigned.length || accounts.data?.paging?.next || assigned.some((account: any) =>
        typeof account?.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(account.id) ||
        typeof account?.username !== 'string' || !/^[A-Za-z0-9._]{1,30}$/.test(account.username),
      )) {
        throw new BadRequestException('Unified Login did not return a complete list of Instagram professional accounts.');
      }
      const uniqueIds = new Set(assigned.map((account: any) => account.id));
      if (uniqueIds.size !== assigned.length) throw new BadRequestException('Unified Login returned duplicate Instagram accounts.');
      const expiresInSec = await this.unifiedTokenExpirySeconds(accessToken, tokenRes.data?.expires_in);
      return {
        accessToken,
        igUserId: assigned[0].id,
        username: assigned[0].username,
        expiresInSec,
        loginMode: 'UNIFIED_LOGIN',
        clientBusinessId,
        unifiedConfigId: this.unifiedConfigId,
        accounts: assigned.map((account: any) => ({ igUserId: account.id, username: account.username })),
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      const status = Number.isInteger(err?.response?.status) ? err.response.status : 'network';
      const rawCode = err?.response?.data?.error?.code;
      const providerCode = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode)) ? String(rawCode) : 'unknown';
      this.log.warn(`Unified Instagram OAuth exchange failed status=${status} providerCode=${providerCode}`);
      throw new BadRequestException('Unified Instagram OAuth exchange failed');
    }
  }

  /**
   * Unified Login's expiry is selected in the Meta configuration. Some code
   * exchange responses omit `expires_in`, so inspect the issued token rather
   * than treating missing metadata as a non-expiring credential. The app
   * access token stays server-side and is never logged or returned.
   */
  private async unifiedTokenExpirySeconds(accessToken: string, expiresIn: unknown): Promise<number | null> {
    const parsedExpiresIn = typeof expiresIn === 'number' || (typeof expiresIn === 'string' && /^\d+(?:\.\d+)?$/.test(expiresIn))
      ? Number(expiresIn)
      : Number.NaN;
    if (Number.isFinite(parsedExpiresIn) && parsedExpiresIn > 0) return parsedExpiresIn;

    return this.inspectUnifiedTokenExpiry(accessToken);
  }

  private async inspectUnifiedTokenExpiry(accessToken: string): Promise<number | null> {
    try {
      const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
      const expectedAppId = this.appId;
      const debug = await axios.get(`https://graph.facebook.com/${version}/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: `${expectedAppId}|${this.appSecret}`,
        },
        timeout: 15_000,
        ...this.httpOptions,
      });
      const data = debug.data?.data;
      if (data?.is_valid !== true || String(data.app_id) !== expectedAppId ||
          !(typeof data.expires_at === 'number' || (typeof data.expires_at === 'string' && /^\d+$/.test(data.expires_at)))) {
        throw new Error('Meta did not return valid token expiry metadata');
      }
      const expiresAt = Number(data.expires_at);
      if (expiresAt === 0) return null; // Meta explicitly reports a non-expiring token.
      const remainingSeconds = expiresAt - Math.floor(Date.now() / 1000);
      if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
        throw new Error('Meta returned an expired token');
      }
      return remainingSeconds;
    } catch (err: any) {
      const status = Number.isInteger(err?.response?.status) ? err.response.status : 'network';
      const rawCode = err?.response?.data?.error?.code;
      const providerCode = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode)) ? String(rawCode) : 'unknown';
      this.log.warn(`Unified Instagram token expiry check failed status=${status} providerCode=${providerCode}`);
      throw new BadRequestException('Meta did not confirm whether this Instagram connection token expires. Check the selected login configuration and retry.');
    }
  }

  async refreshLongLivedToken(currentToken: string): Promise<{ accessToken: string; expiresInSec: number }> {
    const res = await axios.get('https://graph.instagram.com/refresh_access_token', {
      params: { grant_type: 'ig_refresh_token', access_token: currentToken },
      timeout: 15_000,
      ...this.httpOptions,
    });
    return { accessToken: res.data.access_token, expiresInSec: res.data.expires_in ?? 60 * 24 * 60 * 60 };
  }

  /** Refresh an expiring Business Integration System User token. */
  async refreshUnifiedToken(currentToken: string): Promise<{ accessToken: string; expiresInSec: number | null }> {
    if (typeof currentToken !== 'string' || !currentToken.trim()) {
      throw new BadRequestException('The saved Instagram token is missing. Reconnect the account.');
    }
    const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
    try {
      const response = await axios.get(`https://graph.facebook.com/${version}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: this.appId,
          client_secret: this.appSecret,
          set_token_expires_in_60_days: true,
          fb_exchange_token: currentToken,
        },
        timeout: 15_000,
        ...this.httpOptions,
      });
      const accessToken = response.data?.access_token;
      if (typeof accessToken !== 'string' || accessToken.length < 20) {
        throw new Error('Meta returned no replacement token');
      }
      // Verify the replacement token belongs to this app and confirm its actual
      // expiry before replacing the currently stored token.
      const expiresInSec = await this.inspectUnifiedTokenExpiry(accessToken);
      return { accessToken, expiresInSec };
    } catch (err: any) {
      const status = Number.isInteger(err?.response?.status) ? err.response.status : 'network';
      const rawCode = err?.response?.data?.error?.code ?? err?.response?.data?.code;
      const providerCode = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode))
        ? String(rawCode)
        : 'unknown';
      this.log.warn(`Unified Instagram token refresh failed status=${status} providerCode=${providerCode}`);
      throw new ServiceUnavailableException('Meta could not refresh this Instagram token. Reconnect the account if the issue persists.');
    }
  }

  async getMedia(token: string, igUserId: string, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN', after?: string): Promise<{
    media: Array<{ id: string; media_type: string; media_product_type?: string; caption?: string; permalink?: string; timestamp?: string }>;
    nextCursor: string | null;
  }> {
    try {
      const host = loginMode === 'UNIFIED_LOGIN' ? 'graph.facebook.com' : 'graph.instagram.com';
      const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
      const path = loginMode === 'UNIFIED_LOGIN' ? `${encodeURIComponent(igUserId)}/media` : 'me/media';
      // Meta exposes media_product_type (FEED/REELS/STORY/AD) only through
      // Instagram API with Facebook Login. Keep the legacy Instagram Login
      // field set compatible while allowing Unified Login to identify Reels.
      const fields = ['id', 'media_type', 'caption', 'permalink', 'timestamp'];
      if (loginMode === 'UNIFIED_LOGIN') fields.push('media_product_type');
      const res = await axios.get(`https://${host}/${version}/${path}`, {
        params: { fields: fields.join(','), limit: 50, ...(after ? { after } : {}), access_token: token },
        timeout: 15_000,
        ...this.httpOptions,
      });
      const media = Array.isArray(res.data?.data) ? res.data.data : [];
      const nextCursor = typeof res.data?.paging?.next === 'string' && typeof res.data?.paging?.cursors?.after === 'string'
        ? res.data.paging.cursors.after
        : null;
      return { media, nextCursor };
    } catch (err: any) {
      const status = Number.isInteger(err?.response?.status) ? err.response.status : 'network';
      const rawCode = err?.response?.data?.error?.code ?? err?.response?.data?.code;
      const code = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode))
        ? String(rawCode)
        : 'unknown';
      const rawTransportCode = err?.code ?? err?.cause?.code;
      const transportCode = typeof rawTransportCode === 'string' && /^[A-Z][A-Z0-9_]{1,31}$/.test(rawTransportCode)
        ? rawTransportCode
        : 'unknown';
      this.log.warn(`getMedia failed status=${status} providerCode=${code} transportCode=${status === 'network' ? transportCode : 'none'}`);
      if (status === 'network') {
        throw new ServiceUnavailableException('Instagram could not be reached from this backend. Check outbound HTTPS access or the optional META_HTTPS_PROXY setting, then retry.');
      }
      throw new BadRequestException('Could not load media from Instagram');
    }
  }

  async getMediaMetadata(token: string, mediaId: string, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN'): Promise<{ id: string; media_type: string; ownerId: string | null }> {
    const host = loginMode === 'UNIFIED_LOGIN' ? 'graph.facebook.com' : 'graph.instagram.com';
    const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
    try {
      const res = await axios.get(`https://${host}/${version}/${encodeURIComponent(mediaId)}`, {
        params: { fields: 'id,media_type,owner', access_token: token },
        timeout: 15_000,
        ...this.httpOptions,
      });
      const id = res.data?.id;
      const mediaType = res.data?.media_type;
      if (id !== mediaId || typeof mediaType !== 'string') throw new Error('Invalid media metadata response');
      return { id, media_type: mediaType, ownerId: typeof res.data?.owner?.id === 'string' ? res.data.owner.id : null };
    } catch (err: any) {
      const status = Number.isInteger(err?.response?.status) ? err.response.status : 'network';
      const rawCode = err?.response?.data?.error?.code ?? err?.response?.data?.code;
      const code = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode))
        ? String(rawCode)
        : 'unknown';
      this.log.warn(`getMediaMetadata failed status=${status} providerCode=${code}`);
      throw new BadRequestException('Could not verify this Instagram post. Reload recent posts or reconnect the account, then try again.');
    }
  }

  /**
   * Fetch authoritative comment creation time for the private-reply window.
   * The `media` edge also resolves a parent ID omitted from some carousel events.
   */
  async getCommentMetadata(
    token: string,
    commentId: string,
    loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN',
  ): Promise<{ mediaId: string | null; createdAt: string }> {
    const host = loginMode === 'UNIFIED_LOGIN' ? 'graph.facebook.com' : 'graph.instagram.com';
    const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
    try {
      const res = await axios.get(`https://${host}/${version}/${encodeURIComponent(commentId)}`, {
        params: { fields: 'media,timestamp', access_token: token },
        timeout: 10_000,
        ...this.httpOptions,
      });
      const rawTimestamp = res.data?.timestamp;
      const timestamp = typeof rawTimestamp === 'string' ? Date.parse(rawTimestamp) : Number.NaN;
      if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > Date.now() + 5 * 60_000) {
        throw new Error('Meta returned no valid comment creation timestamp');
      }
      const rawMediaId = res.data?.media?.id;
      const mediaId = typeof rawMediaId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(rawMediaId) ? rawMediaId : null;
      return { mediaId, createdAt: new Date(timestamp).toISOString() };
    } catch (err: any) {
      const status = Number.isInteger(err?.response?.status) ? err.response.status : 'network';
      const rawCode = err?.response?.data?.error?.code ?? err?.response?.data?.code;
      const code = Number.isInteger(rawCode) || (typeof rawCode === 'string' && /^\d{1,6}$/.test(rawCode))
        ? String(rawCode)
        : 'unknown';
      this.log.warn(`getCommentMetadata failed status=${status} providerCode=${code}`);
      // Do not acknowledge an event when its send eligibility cannot be
      // verified. Durable webhook processing will retry this lookup.
      throw new ServiceUnavailableException('Instagram comment metadata lookup failed; webhook processing will retry.');
    }
  }
}
