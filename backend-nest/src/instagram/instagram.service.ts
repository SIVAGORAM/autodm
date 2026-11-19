import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface IgTokenResult {
  accessToken: string;
  igUserId: string;
  username: string;
  expiresInSec: number;
}

// Instagram Login API (graph.instagram.com) — matches MetaService.
// Flow: code -> short-lived token -> long-lived (60d) token -> profile.
@Injectable()
export class InstagramService {
  private readonly log = new Logger(InstagramService.name);
  constructor(private config: ConfigService) {}

  private get appId() { return this.config.getOrThrow<string>('META_APP_ID'); }
  private get appSecret() { return this.config.getOrThrow<string>('META_APP_SECRET'); }
  private get redirectUri() { return `${this.config.getOrThrow<string>('PUBLIC_URL')}/api/instagram/callback`; }

  buildAuthUrl(state: string): string {
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
    return `https://www.instagram.com/oauth/authorize?${p.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<IgTokenResult> {
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
    });
    const shortToken: string = shortRes.data.access_token;
    const igUserId: string = String(shortRes.data.user_id);

    // 2. short -> long-lived (≈60 days)
    const longRes = await axios.get('https://graph.instagram.com/access_token', {
      params: { grant_type: 'ig_exchange_token', client_secret: this.appSecret, access_token: shortToken },
    });
    const longToken: string = longRes.data.access_token;
    const expiresInSec: number = longRes.data.expires_in ?? 60 * 24 * 60 * 60;

    // 3. profile
    const me = await axios.get('https://graph.instagram.com/me', {
      params: { fields: 'user_id,username', access_token: longToken },
    });

    return { accessToken: longToken, igUserId, username: me.data.username, expiresInSec };
  }

  async refreshLongLivedToken(currentToken: string): Promise<{ accessToken: string; expiresInSec: number }> {
    const res = await axios.get('https://graph.instagram.com/refresh_access_token', {
      params: { grant_type: 'ig_refresh_token', access_token: currentToken },
    });
    return { accessToken: res.data.access_token, expiresInSec: res.data.expires_in ?? 60 * 24 * 60 * 60 };
  }

  async getMedia(token: string): Promise<Array<{ id: string; media_type: string; caption?: string; permalink?: string }>> {
    try {
      const res = await axios.get('https://graph.instagram.com/me/media', {
        params: { fields: 'id,media_type,caption,permalink,timestamp', limit: 50, access_token: token },
      });
      return res.data.data ?? [];
    } catch (err: any) {
      this.log.warn(`getMedia failed: ${err?.response?.data?.error?.message ?? err.message}`);
      throw new BadRequestException('Could not load media from Instagram');
    }
  }
}
