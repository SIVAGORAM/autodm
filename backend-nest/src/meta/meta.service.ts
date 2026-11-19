import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface DmButton { title: string; url: string; }

// Thin wrapper over the Instagram Graph API. Every send goes through here so
// rate-limit handling and logging live in one place.
@Injectable()
export class MetaService {
  private readonly log = new Logger(MetaService.name);
  private readonly http: AxiosInstance;
  private readonly version: string;

  constructor(config: ConfigService) {
    this.version = config.get<string>('META_GRAPH_VERSION', 'v21.0');
    this.http = axios.create({ baseURL: `https://graph.instagram.com/${this.version}`, timeout: 10_000 });
  }

  // Private reply: DM a user who commented, referencing the comment id.
  async sendCommentDm(igUserId: string, token: string, commentId: string, text: string, buttons: DmButton[] = []) {
    const message = buttons.length
      ? { attachment: { type: 'template', payload: { template_type: 'button', text, buttons: buttons.slice(0, 3).map(b => ({ type: 'web_url', title: b.title, url: b.url })) } } }
      : { text };
    return this.post(`/${igUserId}/messages`, token, { recipient: { comment_id: commentId }, message });
  }

  // Direct message to a user by IGSID (story replies, incoming DMs, follow-ups).
  async sendDirectMessage(igUserId: string, token: string, recipientIgsid: string, text: string, buttons: DmButton[] = []) {
    const message = buttons.length
      ? { attachment: { type: 'template', payload: { template_type: 'button', text, buttons: buttons.slice(0, 3).map(b => ({ type: 'web_url', title: b.title, url: b.url })) } } }
      : { text };
    return this.post(`/${igUserId}/messages`, token, { recipient: { id: recipientIgsid }, message });
  }

  // Public reply under the comment.
  async replyToComment(token: string, commentId: string, text: string) {
    return this.post(`/${commentId}/replies`, token, { message: text });
  }

  async getFollowerInfo(igUserId: string, token: string, igsid: string): Promise<{ isFollower: boolean }> {
    try {
      const { data } = await this.http.get(`/${igUserId}`, { params: { fields: `business_discovery.username(${igsid})`, access_token: token } });
      return { isFollower: !!data };
    } catch {
      return { isFollower: false };
    }
  }

  private async post(path: string, token: string, body: Record<string, unknown>) {
    try {
      const { data } = await this.http.post(path, body, { params: { access_token: token } });
      return { ok: true as const, data };
    } catch (err: any) {
      const detail = err?.response?.data?.error;
      this.log.warn(`Meta API ${path} failed: ${detail?.message ?? err.message}`);
      return { ok: false as const, error: detail?.message ?? err.message, code: detail?.code, retryable: this.isRetryable(detail?.code) };
    }
  }

  // 1/2 = transient, 4/17/32/613 = rate limits -> worth a retry.
  private isRetryable(code?: number): boolean {
    return [1, 2, 4, 17, 32, 613].includes(code ?? -1);
  }
}
