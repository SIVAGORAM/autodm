import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type { InstagramLoginMode } from '../instagram/instagram.service';
import { metaHttpOptions } from '../common/meta-http';

export interface DmButton {
  title: string;
  url?: string;
  type?: 'web_url' | 'postback';
  payload?: string;
}

// Thin wrapper over the Instagram Graph API. Every send goes through here so
// rate-limit handling and logging live in one place.
@Injectable()
export class MetaService {
  private readonly log = new Logger(MetaService.name);
  private readonly http: AxiosInstance;
  private readonly version: string;

  constructor(config: ConfigService) {
    this.version = config.get<string>('META_GRAPH_VERSION') ?? 'v26.0';
    this.http = axios.create({ baseURL: `https://graph.instagram.com/${this.version}`, timeout: 10_000, ...metaHttpOptions(config.get<string>('META_HTTPS_PROXY')) });
  }

  private formatButtons(buttons: DmButton[]) {
    return buttons.slice(0, 3).map((b) => {
      if (b.type === 'postback' || (!b.url && b.payload)) {
        return {
          type: 'postback',
          title: b.title.slice(0, 20),
          payload: (b.payload || b.title).slice(0, 1000),
        };
      }
      return {
        type: 'web_url',
        title: b.title.slice(0, 20),
        url: b.url || 'https://instagram.com',
      };
    });
  }

  // Private reply: DM a user who commented, referencing the comment id.
  async sendCommentDm(igUserId: string, token: string, commentId: string, text: string, buttons: DmButton[] = [], loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN') {
    const message = buttons.length
      ? { attachment: { type: 'template', payload: { template_type: 'button', text, buttons: this.formatButtons(buttons) } } }
      : { text };
    return this.post(`/${igUserId}/messages`, token, { recipient: { comment_id: commentId }, message }, loginMode);
  }

  // Direct message to a user by IGSID (story replies, incoming DMs, follow-ups).
  async sendDirectMessage(igUserId: string, token: string, recipientIgsid: string, text: string, buttons: DmButton[] = [], loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN') {
    const message = buttons.length
      ? { attachment: { type: 'template', payload: { template_type: 'button', text, buttons: this.formatButtons(buttons) } } }
      : { text };
    return this.post(`/${igUserId}/messages`, token, { recipient: { id: recipientIgsid }, message }, loginMode);
  }

  // Public reply under the comment.
  async replyToComment(token: string, commentId: string, text: string, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN') {
    return this.post(`/${commentId}/replies`, token, { message: text }, loginMode);
  }

  async getFollowerInfo(igUserId: string, token: string, igsid: string, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN'): Promise<{ isFollower: boolean }> {
    try {
      const host = loginMode === 'UNIFIED_LOGIN' ? 'https://graph.facebook.com' : 'https://graph.instagram.com';
      const { data } = await this.http.get(`${host}/${this.version}/${encodeURIComponent(igsid)}`, {
        params: { fields: 'is_user_follow_business', access_token: token },
      });
      return { isFollower: data?.is_user_follow_business === true };
    } catch {
      return { isFollower: false };
    }
  }

  private async post(path: string, token: string, body: Record<string, unknown>, loginMode: InstagramLoginMode = 'INSTAGRAM_LOGIN') {
    try {
      const url = loginMode === 'UNIFIED_LOGIN' ? `https://graph.facebook.com/${this.version}${path}` : path;
      const { data } = await this.http.post(url, body, { params: { access_token: token } });
      return { ok: true as const, data };
    } catch (err: any) {
      const detail = err?.response?.data?.error;
      const status = Number.isInteger(err?.response?.status) ? err.response.status : 'network';
      const rawCode = detail?.code;
      const code = Number.isInteger(rawCode) ? rawCode as number : undefined;
      const operation = path.endsWith('/messages') ? 'send_message' : path.endsWith('/replies') ? 'reply_comment' : 'request';
      this.log.warn(`Meta ${operation} failed status=${status} providerCode=${code ?? 'unknown'}`);
      return {
        ok: false as const,
        error: code !== undefined ? `Instagram rejected the request (code ${code})` : `Instagram request failed (${status})`,
        code,
        retryable: this.isRetryable(code, status),
      };
    }
  }

  // 1/2 = transient, 4/17/32/613 = Graph limits, 80002 = Instagram BUC limit.
  // Let BullMQ back off instead of dropping a send on a provider throttle.
  private isRetryable(code?: number, status?: number | 'network'): boolean {
    return status === 'network'
      || (typeof status === 'number' && (status === 408 || status === 429 || status >= 500))
      || [1, 2, 4, 17, 32, 613, 80002].includes(code ?? -1);
  }
}
