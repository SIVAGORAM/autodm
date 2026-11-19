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
    this.from = config.get('MAIL_FROM', 'Relayo <no-reply@relayo.app>');
    this.frontend = (config.get('CORS_ORIGIN', 'http://localhost:3000') as string).split(',')[0];
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host, port: config.get<number>('SMTP_PORT', 587), secure: false, auth: { user, pass },
      });
    } else {
      this.log.warn('SMTP not configured — emails will be logged, not sent.');
    }
  }

  get isConfigured() { return this.transporter !== null; }

  private async send(to: string, subject: string, html: string) {
    if (!this.transporter) { this.log.log(`[email suppressed] to=${to} subject="${subject}"`); return; }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (e: any) {
      this.log.warn(`Email send failed to ${to}: ${e.message}`);
    }
  }

  async sendVerificationEmail(to: string, code: string) {
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px;text-align:center">
        <h2 style="color:#17827E;margin:0 0 6px">Verify your email</h2>
        <p style="color:#5E707A;font-size:14px">Enter this 6-digit code to secure your Relayo account:</p>
        <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#152024;background:#f5f8f8;border:1px solid #e2eaed;border-radius:10px;padding:14px;margin:16px 0">${code}</div>
        <p style="color:#9aa8ad;font-size:12px">This code expires in 15 minutes.</p>
      </div>`;
    await this.send(to, `Your Relayo code: ${code}`, html);
  }

  // The break alert — the heart of the reliability promise.
  async sendBreakAlert(to: string, username: string, reason: string) {
    const link = `${this.frontend}/dashboard/instagram`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:auto;padding:24px;border:1px solid #e2eaed;border-radius:14px">
        <h2 style="color:#17827E;margin:0 0 8px">Your auto-DM needs attention</h2>
        <p style="color:#152024;font-size:15px">The automation on <b>@${username}</b> stopped working:</p>
        <p style="background:#fde7e0;color:#b4411f;padding:10px 14px;border-radius:8px;font-size:14px">${reason}</p>
        <p style="color:#5E707A;font-size:14px">Reconnect now so you don't miss any leads.</p>
        <a href="${link}" style="display:inline-block;background:#F46034;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:8px">Reconnect @${username}</a>
      </div>`;
    await this.send(to, `Action needed: reconnect @${username}`, html);
  }
}
