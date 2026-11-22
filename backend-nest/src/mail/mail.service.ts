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

  constructor(private config: ConfigService) {
    this.from = config.get('MAIL_FROM', 'HeyLaunch <no-reply@heylaunch.app>');
    this.frontend = (config.get('CORS_ORIGIN', 'http://localhost:3000') as string).split(',')[0];
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
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
    } else {
      this.log.warn('SMTP not configured; email send attempts will report delivery failure.');
    }
  }

  get isConfigured() { return this.transporter !== null; }

  private escapeHtml(value: string) {
    return value.replace(/[&<>\"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char] as string));
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.transporter) { this.log.warn('Email suppressed: SMTP is not configured.'); return false; }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      return true;
    } catch (e: any) {
      const rawCode = e?.code;
      const code = typeof rawCode === 'string' && /^[A-Z0-9_]{1,24}$/.test(rawCode) ? rawCode : 'provider error';
      this.log.warn(`Email delivery failed (${code}).`);
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
      <div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17171B;margin:0 0 8px">Reset your HeyLaunch password</h2>
        <p style="color:#667085;font-size:14px">Use this link to choose a new password. It expires in one hour.</p>
        <a href="${safeLink}" style="display:inline-block;background:#17171B;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Set a new password</a>
        <p style="color:#667085;font-size:12px;margin-top:18px">If you didn't request this, you can ignore this email.</p>
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
}
