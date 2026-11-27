import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

// Resilient mailer: if SMTP isn't configured, it logs instead of throwing,
// so dev and tests run without an email server.
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly frontend: string;
  private brevoApiKey: string | null = null;
  private resendApiKey: string | null = null;

  constructor(private config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM')
      || config.get<string>('SMTP_FROM')
      || config.get<string>('EMAIL_FROM')
      || 'Hey Launch <nexloralabs@gmail.com>';
    this.frontend = this.resolveFrontendUrl();

    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS') || config.get<string>('SMTP_PASSWORD');
    const explicitBrevoKey = config.get<string>('BREVO_API_KEY');
    const explicitResendKey = config.get<string>('RESEND_API_KEY');

    if (explicitResendKey && explicitResendKey.trim()) {
      this.resendApiKey = explicitResendKey.trim();
      this.log.log('Resend API key configured; enabling Resend REST API transport.');
    }

    // Detect Brevo REST API key: either explicitly configured via BREVO_API_KEY
    // or passed inside SMTP_PASS (starts with xkeysib-)
    if (explicitBrevoKey && explicitBrevoKey.trim()) {
      this.brevoApiKey = explicitBrevoKey.trim();
    } else if (pass && pass.trim().startsWith('xkeysib-')) {
      this.brevoApiKey = pass.trim();
      this.log.log('Brevo API key detected in SMTP_PASS; enabling Brevo REST API transport.');
    }

    if (host) {
      const port = config.get<number>('SMTP_PORT', 587);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port === 587,
        ...(user && pass ? { auth: { user, pass } } : {}),
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
      });
    }

    if (!this.transporter && !this.brevoApiKey && !this.resendApiKey) {
      this.log.warn('Neither HTTP Email API (Brevo/Resend) nor SMTP is configured; email send attempts will report delivery failure.');
    }
  }

  get isConfigured() { return this.transporter !== null || this.brevoApiKey !== null || this.resendApiKey !== null; }

  private parseSender(): { name: string; email: string } {
    const match = this.from.match(/^(?:(?:"?([^"]*)"?\s)?<([^>]+)>|([^<>\s]+))$/);
    const name = match ? (match[1] || match[3] || 'HeyLaunch').trim() : 'HeyLaunch';
    const email = match ? (match[2] || match[3] || '').trim() : this.from;
    return { name, email };
  }

  private resolveFrontendUrl(): string {
    const explicit = this.config.get<string>('FRONTEND_URL') || this.config.get<string>('APP_URL');
    if (explicit && explicit.trim()) return explicit.trim().replace(/\/+$/, '');

    const corsOrigins = (this.config.get<string>('CORS_ORIGIN', '') || '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    // Prefer live production origins over localhost
    const prodOrigin = corsOrigins.find((o) => !o.includes('localhost') && !o.includes('127.0.0.1'));
    if (prodOrigin) return prodOrigin;

    // Check if INSTAGRAM_OAUTH_REDIRECT_URI has the production frontend origin
    const redirectUri = this.config.get<string>('INSTAGRAM_OAUTH_REDIRECT_URI');
    if (redirectUri) {
      try {
        const parsed = new URL(redirectUri);
        if (parsed.origin && !parsed.origin.includes('localhost')) {
          return parsed.origin;
        }
      } catch {
        // ignore parsing error
      }
    }

    if (corsOrigins.length > 0) return corsOrigins[0];

    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    return isProd ? 'https://frontend-fawn-six-26.vercel.app' : 'http://localhost:3000';
  }

  private async sendViaBrevoApi(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.brevoApiKey) return false;
    const sender = this.parseSender();
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: sender.name, email: sender.email },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      if (res.ok) {
        this.log.debug(`Email delivered via Brevo REST API to ${to}`);
        return true;
      }

      const body = await res.text().catch(() => '');
      this.log.warn(`Brevo API delivery failed (HTTP ${res.status}): ${body.slice(0, 160)}`);
      return false;
    } catch (err: any) {
      this.log.warn(`Brevo API network error: ${err?.message || 'unknown error'}`);
      return false;
    }
  }

  private async sendViaResendApi(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.resendApiKey) return false;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [to],
          subject,
          html,
        }),
      });

      if (res.ok) {
        this.log.debug(`Email delivered via Resend REST API to ${to}`);
        return true;
      }

      const body = await res.text().catch(() => '');
      this.log.warn(`Resend API delivery failed (HTTP ${res.status}): ${body.slice(0, 160)}`);
      return false;
    } catch (err: any) {
      this.log.warn(`Resend API network error: ${err?.message || 'unknown error'}`);
      return false;
    }
  }

  async verifyConnection(): Promise<{ ok: boolean; method: 'resend_api' | 'brevo_api' | 'smtp' | 'none'; message: string }> {
    if (this.resendApiKey) {
      try {
        const res = await fetch('https://api.resend.com/api-keys', {
          headers: { Authorization: `Bearer ${this.resendApiKey}` },
        });
        if (res.ok) {
          return { ok: true, method: 'resend_api', message: 'Connected to Resend API (key verified)' };
        }
        return { ok: false, method: 'resend_api', message: `Resend API rejected key (HTTP ${res.status})` };
      } catch (err: any) {
        return { ok: false, method: 'resend_api', message: `Resend API connection error: ${err?.message || 'network failed'}` };
      }
    }

    if (this.brevoApiKey) {
      try {
        const res = await fetch('https://api.brevo.com/v3/account', {
          headers: { 'api-key': this.brevoApiKey, 'Accept': 'application/json' },
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { email?: string };
          return { ok: true, method: 'brevo_api', message: `Connected to Brevo API (${data.email || 'account verified'})` };
        }
        return { ok: false, method: 'brevo_api', message: `Brevo API rejected key (HTTP ${res.status})` };
      } catch (err: any) {
        return { ok: false, method: 'brevo_api', message: `Brevo API connection error: ${err?.message || 'network failed'}` };
      }
    }

    if (this.transporter) {
      try {
        await this.transporter.verify();
        return { ok: true, method: 'smtp', message: 'SMTP connection verified successfully' };
      } catch (err: any) {
        return { ok: false, method: 'smtp', message: `SMTP verification failed: ${err?.message || 'connection failed'}` };
      }
    }

    return { ok: false, method: 'none', message: 'Neither HTTP Email API (Resend/Brevo) nor SMTP is configured' };
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>\"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char] as string));
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    if (this.resendApiKey) {
      const ok = await this.sendViaResendApi(to, subject, html);
      if (ok) return true;
      if (!this.brevoApiKey && !this.transporter) return false;
      this.log.log('Resend REST API failed, attempting fallbacks...');
    }

    if (this.brevoApiKey) {
      const ok = await this.sendViaBrevoApi(to, subject, html);
      if (ok) return true;
      if (!this.transporter) return false;
      this.log.log('Brevo REST API failed, attempting SMTP fallback...');
    }

    if (!this.transporter) {
      this.log.warn('Email suppressed: Neither HTTP Email API nor SMTP is configured.');
      return false;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      return true;
    } catch (e: any) {
      const rawCode = e?.code;
      const code = typeof rawCode === 'string' && /^[A-Z0-9_]{1,24}$/.test(rawCode) ? rawCode : 'provider error';
      this.log.warn(`Email delivery failed (${code}): ${e?.message || 'unknown error'}`);
      return false;
    }
  }

  async sendVerificationEmail(to: string, code: string): Promise<boolean> {
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px;text-align:center">
        <h2 style="color:#17827E;margin:0 0 6px">Verify your email</h2>
        <p style="color:#5E707A;font-size:14px">Enter this 6-digit code to secure your HeyLaunch account:</p>
        <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#152024;background:#f5f8f8;border:1px solid #e2eaed;border-radius:10px;padding:14px;margin:16px 0">${code}</div>
        <p style="color:#9aa8ad;font-size:12px">This code expires in 15 minutes.</p>
      </div>`;
    return this.send(to, `Your HeyLaunch code: ${code}`, html);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    const link = `${this.frontend}/reset-password?token=${encodeURIComponent(token)}`;
    const safeLink = this.escapeHtml(link);
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:28px 24px;border:1px solid #e2eaed;border-radius:14px;background:#ffffff">
        <h2 style="color:#17171B;margin:0 0 8px;font-size:22px">Reset your HeyLaunch password</h2>
        <p style="color:#667085;font-size:14px;line-height:1.5">Use the button below to choose a new password. This reset link is valid for <b>one hour</b>.</p>
        <div style="margin:20px 0">
          <a href="${safeLink}" style="display:inline-block;background:#17171B;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">Set a new password</a>
        </div>
        <p style="color:#667085;font-size:12px;line-height:1.6;margin-top:20px;word-break:break-all">
          If the button above does not open, copy and paste this URL into your browser:<br>
          <a href="${safeLink}" style="color:#17827E;text-decoration:underline">${safeLink}</a>
        </p>
        <hr style="border:0;border-top:1px solid #f0f2f5;margin:20px 0 16px">
        <p style="color:#9aa8ad;font-size:12px;margin:0">If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.</p>
      </div>`;
    return this.send(to, 'Reset your HeyLaunch password', html);
  }

  // The break alert — the heart of the reliability promise.
  async sendBreakAlert(to: string, username: string, reason: string): Promise<boolean> {
    const link = `${this.frontend}/dashboard/instagram`;
    const safeUsername = this.escapeHtml(username);
    const safeReason = this.escapeHtml(reason);
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17827E;margin:0 0 8px">Your auto-DM needs attention</h2>
        <p style="color:#152024;font-size:15px">The automation on <b>@${safeUsername}</b> stopped working:</p>
        <p style="background:#fde7e0;color:#b4411f;padding:10px 14px;border-radius:8px;font-size:14px">${safeReason}</p>
        <p style="color:#5E707A;font-size:14px">Reconnect now so you don't miss any leads.</p>
        <a href="${this.escapeHtml(link)}" style="display:inline-block;background:#F46034;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:8px">Reconnect @${safeUsername}</a>
      </div>`;
    return this.send(to, `Action needed: reconnect @${safeUsername}`, html);
  }

  // Trial-ending nudge — the conversion driver.
  async sendTrialEndingEmail(to: string, name: string, hoursLeft: number): Promise<boolean> {
    const link = `${this.frontend}/dashboard/billing`;
    const hrs = Math.max(1, Math.round(hoursLeft));
    const firstName = this.escapeHtml((name || 'there').split(' ')[0]);
    const safeLink = this.escapeHtml(link);
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17827E;margin:0 0 8px">Your Pro trial ends in ${hrs} hour${hrs === 1 ? '' : 's'}</h2>
        <p style="color:#152024;font-size:15px">Hi ${firstName}, your free HeyLaunch Pro trial is almost up.</p>
        <p style="color:#5E707A;font-size:14px">Upgrade now to keep your automations running, multiple connected accounts, and every Pro feature. If you don't upgrade, your account will switch to the Free plan automatically — no charge, no surprises.</p>
        <a href="${safeLink}" style="display:inline-block;background:#F46034;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:8px">Upgrade to Pro</a>
        <p style="color:#9aa8ad;font-size:12px;margin-top:16px">You're receiving this because you started a HeyLaunch Pro trial.</p>
      </div>`;
    return this.send(to, `Your HeyLaunch Pro trial ends in ${hrs} hour${hrs === 1 ? '' : 's'}`, html);
  }

  // Welcome — sent once the user verifies, setting expectations for the trial.
  async sendTrialWelcomeEmail(to: string, name: string): Promise<boolean> {
    const link = `${this.frontend}/dashboard`;
    const firstName = this.escapeHtml((name || 'there').split(' ')[0]);
    const safeLink = this.escapeHtml(link);
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17827E;margin:0 0 8px">Welcome to HeyLaunch, ${firstName} 🎉</h2>
        <p style="color:#152024;font-size:15px">Your <b>2-day Pro trial</b> is live. Here is what your trial includes:</p>
        <ul style="color:#5E707A;font-size:14px;padding-left:18px;margin:12px 0">
          <li>Up to 5 Instagram accounts</li>
          <li>Up to 10,000 DMs per month</li>
          <li>Follow-ups, click tracking, automation health, and delivery logs</li>
        </ul>
        <p style="color:#5E707A;font-size:14px">After 2 days your account switches to Free automatically — no charge unless you choose to upgrade.</p>
        <a href="${safeLink}" style="display:inline-block;background:#F46034;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:8px">Open your dashboard</a>
      </div>`;
    return this.send(to, `Welcome to HeyLaunch — your 2-day Pro trial is live`, html);
  }
  async sendSupportReplyEmail(to: string, subject: string): Promise<boolean> {
    const link = this.escapeHtml(`${this.frontend}/dashboard/help/email-us`);
    const safeSubject = this.escapeHtml(subject);
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17827E;margin:0 0 8px">A reply is waiting for you</h2>
        <p style="color:#152024;font-size:15px">The HeyLaunch team replied to your support request, <b>${safeSubject}</b>.</p>
        <p style="color:#5E707A;font-size:14px">Sign in to your account to read and respond. We do not include support message contents in email.</p>
        <a href="${link}" style="display:inline-block;background:#17827E;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:8px">Open support inbox</a>
      </div>`;
    return this.send(to, 'A reply to your HeyLaunch support request', html);
  }

  async sendSupportAdminNotificationEmail(to: string, subject: string): Promise<boolean> {
    const link = this.escapeHtml(`${this.frontend}/dashboard/admin/support`);
    const safeSubject = this.escapeHtml(subject);
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17827E;margin:0 0 8px">A customer support update is waiting</h2>
        <p style="color:#152024;font-size:15px">A customer submitted or replied to <b>${safeSubject}</b>.</p>
        <p style="color:#5E707A;font-size:14px">Sign in to the HeyLaunch admin dashboard to review the thread. The message contents are not included in email.</p>
        <a href="${link}" style="display:inline-block;background:#17827E;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:8px">Open support inbox</a>
      </div>`;
    return this.send(to, 'A customer updated HeyLaunch support', html);
  }

  async sendContactEnquiryNotificationEmail(to: string, enquiryId: string, subject: string): Promise<boolean> {
    const link = this.escapeHtml(`${this.frontend}/dashboard/admin/enquiries/${encodeURIComponent(enquiryId)}`);
    const safeSubject = this.escapeHtml(subject);
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17827E;margin:0 0 8px">A new HeyLaunch enquiry arrived</h2>
        <p style="color:#152024;font-size:15px">A visitor submitted a contact enquiry about <b>${safeSubject}</b>.</p>
        <p style="color:#5E707A;font-size:14px">Sign in to the admin dashboard to review and reply. The sender's message and address are not included in this notification.</p>
        <a href="${link}" style="display:inline-block;background:#17827E;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:8px">Open enquiry</a>
      </div>`;
    return this.send(to, 'A new HeyLaunch contact enquiry', html);
  }

  async sendContactReplyEmail(to: string, name: string, subject: string, body: string): Promise<boolean> {
    const safeName = this.escapeHtml(name);
    const safeSubject = this.escapeHtml(subject);
    const safeBody = this.escapeHtml(body).replace(/\r?\n/g, '<br>');
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17827E;margin:0 0 8px">A reply from HeyLaunch</h2>
        <p style="color:#152024;font-size:15px">Hi ${safeName}, our team replied to your enquiry, <b>${safeSubject}</b>:</p>
        <div style="white-space:pre-wrap;color:#344054;font-size:14px;line-height:1.65;padding:14px;border:1px solid #e2eaed;border-radius:10px">${safeBody}</div>
        <p style="color:#667085;font-size:12px;margin-top:18px">This is an email notification of the response recorded in your HeyLaunch enquiry thread.</p>
      </div>`;
    return this.send(to, `HeyLaunch replied: ${subject}`, html);
  }

  async sendAdminInvitationEmail(to: string, token: string, expiresAt: Date): Promise<boolean> {
    const link = this.escapeHtml(`${this.frontend}/admin/invite#token=${encodeURIComponent(token)}`);
    const expiry = this.escapeHtml(expiresAt.toUTCString());
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17171B;margin:0 0 8px">You’re invited to HeyLaunch</h2>
        <p style="color:#475467;font-size:14px;line-height:1.6">A HeyLaunch Super Admin invited this email address to join the administrator team. Create or verify a HeyLaunch account using this same email, then return to this invitation to accept it.</p>
        <a href="${link}" style="display:inline-block;background:#17171B;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Review invitation</a>
        <p style="color:#667085;font-size:12px;margin-top:18px">This one-use invitation expires ${expiry}. If you weren’t expecting it, ignore this email.</p>
      </div>`;
    return this.send(to, 'Invitation to join the HeyLaunch admin team', html);
  }

  async sendWeeklyCelebrationEmail(
    to: string,
    stats: {
      creatorName: string;
      dmsSent: number;
      newFollowers: number;
      linkClicks: number;
      topAutomationName?: string | null;
      topAutomationClickRate?: number | null;
    },
  ): Promise<boolean> {
    const firstName = this.escapeHtml((stats.creatorName || 'there').split(' ')[0]);
    const safeTopName = this.escapeHtml(stats.topAutomationName || 'Active Reels');
    const safeRate = Math.min(Math.max(Number(stats.topAutomationClickRate ?? 0), 0), 100);
    const link = this.escapeHtml(`${this.frontend}/dashboard/analytics`);
    const subject = `🎉 ${firstName}, your automations were on fire this week!`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:auto;padding:28px;background:#ffffff;border:1px solid #e2eaed;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.05)">
        <div style="text-align:center;margin-bottom:20px">
          <span style="display:inline-block;padding:6px 14px;background:#FFF4ED;border-radius:20px;color:#F46034;font-weight:700;font-size:12px">
            🚀 WEEKLY CREATOR REPORT
          </span>
          <h2 style="color:#152024;font-size:22px;margin:12px 0 6px;font-weight:800">
            Hey ${firstName}! 🎉
          </h2>
          <p style="color:#5E707A;font-size:14px;margin:0;line-height:1.5">
            Your automations were on fire this week. Here is your Instagram growth for the past 7 days:
          </p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0">
          <div style="background:#F8FAFB;border:1px solid #E5EBEF;border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#17827E">${stats.dmsSent.toLocaleString()}</div>
            <div style="font-size:12px;font-weight:600;color:#5E707A;margin-top:4px">⚡ DMs Delivered</div>
          </div>
          <div style="background:#F8FAFB;border:1px solid #E5EBEF;border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#8B5CF6">+${stats.newFollowers.toLocaleString()}</div>
            <div style="font-size:12px;font-weight:600;color:#5E707A;margin-top:4px">👤 New Followers</div>
          </div>
          <div style="background:#F8FAFB;border:1px solid #E5EBEF;border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:24px;font-weight:800;color:#F46034">${stats.linkClicks.toLocaleString()}</div>
            <div style="font-size:12px;font-weight:600;color:#5E707A;margin-top:4px">🔗 Link Clicks</div>
          </div>
          <div style="background:#F8FAFB;border:1px solid #E5EBEF;border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:18px;font-weight:800;color:#152024;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeTopName}</div>
            <div style="font-size:12px;font-weight:600;color:#5E707A;margin-top:4px">🏆 Top Automation (${safeRate}% CTR)</div>
          </div>
        </div>

        <div style="background:#FFF9F5;border:1px solid #FFE6D5;border-radius:12px;padding:12px 14px;margin-bottom:22px">
          <p style="margin:0;color:#9A3412;font-size:12px;line-height:1.5">
            📸 <b>Story Tip:</b> Take a quick screenshot of this email and post it to your Instagram Story to celebrate with your fans and build brand authority!
          </p>
        </div>

        <div style="text-align:center">
          <a href="${link}" style="display:inline-block;background:#F46034;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">
            View Analytics Dashboard →
          </a>
        </div>
        <p style="color:#9AA8AD;font-size:11px;text-align:center;margin-top:20px">
          Keep crushing it! — Team HeyLaunch
        </p>
      </div>`;
    return this.send(to, subject, html);
  }
}
