import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  it('supports unauthenticated local SMTP capture servers', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail } as any);
    const values: Record<string, unknown> = { SMTP_HOST: 'mailpit', SMTP_PORT: 1025 };
    const config: any = { get: (key: string, fallback?: unknown) => values[key] ?? fallback };
    const mail = new MailService(config);

    await expect(mail.sendVerificationEmail('creator@example.test', '123456')).resolves.toBe(true);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'mailpit', port: 1025 }));
    expect(createTransport.mock.calls[0][0]).not.toHaveProperty('auth');
    expect(sendMail).toHaveBeenCalledTimes(1);
    createTransport.mockRestore();
  });

  it.each([
    [465, true],
    [587, false],
  ])('uses the expected TLS mode for SMTP port %i', (port, secure) => {
    const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: jest.fn() } as any);
    const values: Record<string, unknown> = { SMTP_HOST: 'smtp.example.test', SMTP_USER: 'mailer', SMTP_PASS: 'test-only', SMTP_PORT: port };
    const config: any = { get: (key: string, fallback?: unknown) => values[key] ?? fallback };

    const mail = new MailService(config);

    expect(mail.isConfigured).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.test', port, secure, requireTLS: port === 587,
    }));
    createTransport.mockRestore();
  });

  it('does not write verification codes, recipients, or email subjects to logs', async () => {
    const config: any = { get: (key: string, fallback?: unknown) => fallback };
    const mail = new MailService(config);
    const warn = jest.spyOn((mail as any).log, 'warn').mockImplementation();
    const log = jest.spyOn((mail as any).log, 'log').mockImplementation();

    await expect(mail.sendVerificationEmail('creator@example.test', '123456')).resolves.toBe(false);

    const output = [...warn.mock.calls, ...log.mock.calls].flat().join(' ');
    expect(output).not.toContain('123456');
    expect(output).not.toContain('creator@example.test');
    expect(output).not.toContain('Your HeyLaunch code');
  });

  it('escapes support subjects and sends customers back to the signed-in inbox', async () => {
    const config: any = { get: (key: string, fallback?: unknown) => fallback };
    const mail = new MailService(config);
    const sendMail = jest.fn().mockResolvedValue({});
    (mail as any).transporter = { sendMail };

    await expect(mail.sendSupportReplyEmail('creator@example.test', '<script>alert(1)</script>')).resolves.toBe(true);

    const content = sendMail.mock.calls[0][0];
    expect(content.subject).toBe('A reply to your HeyLaunch support request');
    expect(content.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('/dashboard/help/email-us');
    expect(content.html).not.toContain('private message text');
  });

  it('keeps customer message contents out of support operations alerts', async () => {
    const config: any = { get: (key: string, fallback?: unknown) => fallback };
    const mail = new MailService(config);
    const sendMail = jest.fn().mockResolvedValue({});
    (mail as any).transporter = { sendMail };

    await expect(mail.sendSupportAdminNotificationEmail('ops@example.test', 'Login help')).resolves.toBe(true);

    const content = sendMail.mock.calls[0][0];
    expect(content.to).toBe('ops@example.test');
    expect(content.html).toContain('/dashboard/admin/support');
    expect(content.html).not.toContain('customer message body');
  });

  it('escapes public contact replies and enquiry IDs in notification links', async () => {
    const config: any = { get: (key: string, fallback?: unknown) => (key === 'FRONTEND_URL' || key === 'APP_URL' ? 'https://heylaunch.example' : fallback) };
    const mail = new MailService(config);
    const sendMail = jest.fn().mockResolvedValue({});
    (mail as any).transporter = { sendMail };

    await expect(mail.sendContactReplyEmail('creator@example.test', '<img src=x>', 'Question', '<script>alert(1)</script>'))
      .resolves.toBe(true);
    const reply = sendMail.mock.calls[0][0];
    expect(reply.html).toContain('&lt;img src=x&gt;');
    expect(reply.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(reply.html).not.toContain('<script>');

    await expect(mail.sendContactEnquiryNotificationEmail('ops@example.test', 'enquiry-1', '<script>subject</script>')).resolves.toBe(true);
    const notification = sendMail.mock.calls[1][0];
    expect(notification.html).toContain('/dashboard/admin/enquiries/enquiry-1');
    expect(notification.html).toContain('&lt;script&gt;subject&lt;/script&gt;');
    expect(notification.html).not.toContain('visitor email');
  });

  it('sends a time-limited admin invite link without exposing it in an HTTP query string', async () => {
    const config: any = { get: (key: string, fallback?: unknown) => (key === 'FRONTEND_URL' || key === 'APP_URL' ? 'https://heylaunch.example' : fallback) };
    const mail = new MailService(config);
    const sendMail = jest.fn().mockResolvedValue({});
    (mail as any).transporter = { sendMail };
    const token = 'c'.repeat(43);
    const expiresAt = new Date('2026-12-01T00:00:00.000Z');
    await expect(mail.sendAdminInvitationEmail('new-admin@example.test', token, expiresAt)).resolves.toBe(true);
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toBe('new-admin@example.test');
    expect(message.html).toContain(`/admin/invite#token=${token}`);
    expect(message.html).not.toContain(`/admin/invite?token=${token}`);
    expect(message.html).toContain(expiresAt.toUTCString());
  });

  it('describes trial limits and implemented features without promising every feature', async () => {
    const values: Record<string, string> = {
      SMTP_HOST: 'smtp.example.test',
      SMTP_USER: 'mailer',
      SMTP_PASS: 'test-only',
    };
    const config: any = { get: (key: string, fallback?: unknown) => values[key] ?? fallback };
    const mail = new MailService(config);
    const sendMail = jest.fn().mockResolvedValue({});
    (mail as any).transporter = { sendMail };

    await expect(mail.sendTrialWelcomeEmail('creator@example.test', 'A Creator')).resolves.toBe(true);

    const html = sendMail.mock.calls[0][0].html as string;
    expect(html).toContain('Up to 5 Instagram accounts');
    expect(html).toContain('Up to 10,000 DMs per month');
    expect(html).toContain('Follow-ups, click tracking, automation health, and delivery logs');
    expect(html).not.toContain('every feature unlocked');
    expect(html).not.toContain('Full analytics');
  });

  it('detects Brevo API key when configured or when passed via SMTP_PASS', async () => {
    const configWithApi: any = {
      get: (key: string, fallback?: unknown) => ({ BREVO_API_KEY: 'xkeysib-test-key' }[key] ?? fallback),
    };
    const mailWithApi = new MailService(configWithApi);
    expect(mailWithApi.isConfigured).toBe(true);

    const configWithPass: any = {
      get: (key: string, fallback?: unknown) => ({ SMTP_PASS: 'xkeysib-detected-key' }[key] ?? fallback),
    };
    const mailWithPass = new MailService(configWithPass);
    expect(mailWithPass.isConfigured).toBe(true);
  });
});
