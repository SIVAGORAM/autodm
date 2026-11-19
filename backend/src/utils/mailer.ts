import nodemailer from 'nodemailer';
import { env } from '../configs/env';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const mailer = {
  async sendEmail({ to, subject, html, attachments }: { to: string; subject: string; html: string; attachments?: any[] }) {
    return transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
      attachments,
    });
  },

  async sendVerificationEmail(email: string, code: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; background: #0b0a14; color: #fff; padding: 20px; border-radius: 12px; max-width: 400px; margin: auto;">
        <h2 style="text-align: center; color: #a855f7;">Verify Your Identity</h2>
        <p style="text-align: center; font-size: 14px; text-shadow: 0 0 4px #aaa;">Welcome to AutoDM! Enter the 6-digit PIN below to secure your account:</p>
        <div style="text-align: center; font-size: 28px; font-weight: 900; background: #121124; border: 1px solid #3b3a53; padding: 10px; border-radius: 8px; margin: 20px 0; letter-spacing: 4px; color: #fff;">
          ${code}
        </div>
        <p style="text-align: center; font-size: 10px; color: #777;">Code expires in 15 minutes.</p>
      </div>
    `;
    return this.sendEmail({ to: email, subject: 'Verify Your Email - AutoDM', html });
  },

  async sendResetPasswordEmail(email: string, token: string) {
    const resetLink = `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/reset-password?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; background: #0b0a14; color: #fff; padding: 20px; border-radius: 12px; max-width: 400px; margin: auto;">
        <h2 style="text-align: center; color: #a855f7;">Reset Your Password</h2>
        <p style="text-align: center; font-size: 14px;">We received a request to reset your password. Click the link below to set a new command:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #a855f7; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 900; font-size: 14px; display: inline-block;">Update Password</a>
        </div>
        <p style="text-align: center; font-size: 10px; color: #777;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `;
    return this.sendEmail({ to: email, subject: 'Reset Your Password - AutoDM', html });
  }
};
