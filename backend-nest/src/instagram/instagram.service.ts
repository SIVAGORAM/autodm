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

  async subscribeToWebhooks(igUserId: string, token: string, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN'): Promise<void> {
    const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
    const host = loginMode === 'UNIFIED_LOGIN' ? 'graph.facebook.com' : 'graph.instagram.com';
    try {
      await axios.post(`https://${host}/${version}/${encodeURIComponent(igUserId)}/subscribed_apps`, null, {
        params: { subscribed_fields: 'comments,messages', access_token: token },
        timeout: 15_000,
        ...this.httpOptions,
      });
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
  get unifiedLoginEnabled() { return this.config.get<boolean>('META_UNIFIED_LOGIN_ENABLED') === true || this.config.get('META_UNIFIED_LOGIN_ENABLED') === 'true'; }
  private get unifiedConfigId() { return this.config.get<string>('META_UNIFIED_LOGIN_CONFIG_ID') ?? ''; }
  private get redirectUri() { return `${this.config.getOrThrow<string>('PUBLIC_URL').trim().replace(/\/+$/, '')}/api/instagram/callback`; }

  buildAuthUrl(state: string, forceReauth = false, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN'): string {
    if (loginMode === 'UNIFIED_LOGIN') {
      if (!this.unifiedLoginEnabled || !this.unifiedConfigId.trim()) throw new BadRequestException('Unified Instagram Login is not configured.');
      const p = new URLSearchParams({
        client_id: this.appId,
        config_id: this.unifiedConfigId,
        redirect_uri: this.redirectUri,
        response_type: 'code',
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
      client_id: this.appId,
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
      client_id: this.appId,
      client_secret: this.appSecret,
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
      params: { grant_type: 'ig_exchange_token', client_secret: this.appSecret, access_token: shortToken },
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
      const expiresInSec = Number.isFinite(Number(tokenRes.data.expires_in)) && Number(tokenRes.data.expires_in) > 0
        ? Number(tokenRes.data.expires_in)
        : null;
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

  async refreshLongLivedToken(currentToken: string): Promise<{ accessToken: string; expiresInSec: number }> {
    const res = await axios.get('https://graph.instagram.com/refresh_access_token', {
      params: { grant_type: 'ig_refresh_token', access_token: currentToken },
      timeout: 15_000,
      ...this.httpOptions,
    });
    return { accessToken: res.data.access_token, expiresInSec: res.data.expires_in ?? 60 * 24 * 60 * 60 };
  }

  async getMedia(token: string, igUserId: string, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN', after?: string): Promise<{
    media: Array<{ id: string; media_type: string; media_product_type?: string; caption?: string; permalink?: string; timestamp?: string }>;
    nextCursor: string | null;
  }> {
    try {
      const host = loginMode === 'UNIFIED_LOGIN' ? 'graph.facebook.com' : 'graph.instagram.com';
      const version = this.config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
      const path = loginMode === 'UNIFIED_LOGIN' ? `${encodeURIComponent(igUserId)}/media` : 'me/media';
      const res = await axios.get(`https://${host}/${version}/${path}`, {
        params: { fields: 'id,media_type,caption,permalink,timestamp', limit: 50, ...(after ? { after } : {}), access_token: token },
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
}
