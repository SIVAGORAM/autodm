import { createHash, createHmac } from 'crypto';
import { MailOutboxService } from './mail-outbox.service';

describe('MailOutboxService', () => {
  const secret = 'test-only-jwt-access-secret';

  function setup(row: any, user: any, sendMail = true, supportEmail = '') {
    const prisma: any = {
      mailOutbox: {
        findMany: jest.fn().mockResolvedValue([row]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      contactEnquiry: { findUnique: jest.fn() },
      contactEnquiryMessage: { findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      adminInvitation: { findUnique: jest.fn() },
    };
    const mail: any = {
      sendVerificationEmail: jest.fn().mockResolvedValue(sendMail),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(sendMail),
      sendTrialWelcomeEmail: jest.fn().mockResolvedValue(sendMail),
      sendSupportReplyEmail: jest.fn().mockResolvedValue(sendMail),
      sendSupportAdminNotificationEmail: jest.fn().mockResolvedValue(sendMail),
      sendContactEnquiryNotificationEmail: jest.fn().mockResolvedValue(sendMail),
      sendContactReplyEmail: jest.fn().mockResolvedValue(sendMail),
      sendAdminInvitationEmail: jest.fn().mockResolvedValue(sendMail),
    };
    const encryption: any = { decrypt: jest.fn((value) => value) };
    const config: any = { getOrThrow: jest.fn().mockReturnValue(secret), get: jest.fn().mockReturnValue(supportEmail) };
    return { service: new MailOutboxService(prisma, encryption, mail, config), prisma, mail, encryption };
  }

  it('encrypts verification payloads before persisting them', async () => {
    const tx: any = { mailOutbox: { create: jest.fn().mockResolvedValue({}) } };
    const encryption: any = { encrypt: jest.fn().mockReturnValue('encrypted-payload') };
    const service = new MailOutboxService({} as any, encryption, {} as any, {} as any);

    await service.queueVerification(tx, 'user-1', 'creator@example.test', '123456', new Date('2026-11-21T10:15:00Z'));

    const input = tx.mailOutbox.create.mock.calls[0][0].data;
    expect(input.payloadEnc).toBe('encrypted-payload');
    expect(JSON.stringify(input)).not.toContain('123456');
    expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify({ kind: 'verification', to: 'creator@example.test', code: '123456' }));
  });

  it('encrypts and deduplicates support reply notifications in the caller transaction', async () => {
    const tx: any = { mailOutbox: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const encryption: any = { encrypt: jest.fn().mockReturnValue('encrypted-payload') };
    const service = new MailOutboxService({} as any, encryption, {} as any, {} as any);

    await service.queueSupportReply(tx, 'user-1', 'creator@example.test', 'Login help', 'message-1');

    const row = tx.mailOutbox.createMany.mock.calls[0][0];
    expect(row.skipDuplicates).toBe(true);
    expect(row.data[0]).toMatchObject({ userId: 'user-1', dedupeKey: 'support-reply:message-1', payloadEnc: 'encrypted-payload' });
    expect(row.data[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify({ kind: 'support-reply', to: 'creator@example.test', subject: 'Login help' }));
  });

  it('queues encrypted public enquiry notifications without storing the visitor message in email', async () => {
    const tx: any = { mailOutbox: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const encryption: any = { encrypt: jest.fn().mockReturnValue('encrypted') };
    const service = new MailOutboxService({} as any, encryption, {} as any, { get: jest.fn().mockReturnValue('ops@example.test') } as any);
    await service.queueContactEnquiryNotification(tx, 'enquiry-1', 'Agency question');
    expect(tx.mailOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ dedupeKey: 'contact-admin:enquiry-1', payloadEnc: 'encrypted' })], skipDuplicates: true,
    }));
    expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify({ kind: 'contact-admin', to: 'ops@example.test', enquiryId: 'enquiry-1', subject: 'Agency question' }));
  });

  it('queues contact replies with a one-to-one outbox link and encrypted body', async () => {
    const tx: any = { mailOutbox: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const encryption: any = { encrypt: jest.fn().mockReturnValue('encrypted') };
    const service = new MailOutboxService({} as any, encryption, {} as any, {} as any);
    await service.queueContactReply(tx, {
      enquiryId: 'enquiry-1', messageId: 'message-1', to: 'creator@example.test', name: 'Creator',
      subject: 'Question', body: 'Thanks for contacting us.',
    });
    expect(tx.mailOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ contactEnquiryMessageId: 'message-1', dedupeKey: 'contact-reply:message-1' })], skipDuplicates: true,
    }));
    expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify({
      kind: 'contact-reply', enquiryId: 'enquiry-1', messageId: 'message-1', to: 'creator@example.test',
      name: 'Creator', subject: 'Question', body: 'Thanks for contacting us.',
    }));
  });

  it('stores an encrypted, expiring invitation email in the durable outbox', async () => {
    const tx: any = { mailOutbox: { create: jest.fn().mockResolvedValue({}) } };
    const encryption: any = { encrypt: jest.fn().mockReturnValue('encrypted-invitation') };
    const service = new MailOutboxService({} as any, encryption, {} as any, {} as any);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    const token = 'a'.repeat(43);
    await service.queueAdminInvitation(tx, { invitationId: '77a84c10-5c25-4d1c-a15d-c3832348e482', to: 'new-admin@example.test', token, expiresAt });
    expect(tx.mailOutbox.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      dedupeKey: 'admin-invitation:77a84c10-5c25-4d1c-a15d-c3832348e482', payloadEnc: 'encrypted-invitation', expiresAt,
    }) });
    expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify({
      kind: 'admin-invitation', to: 'new-admin@example.test', invitationId: '77a84c10-5c25-4d1c-a15d-c3832348e482', token, expiresAt: expiresAt.toISOString(),
    }));
  });

  it('queues an encrypted operations alert only when an inbox is configured', async () => {
    const tx: any = { mailOutbox: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const encryption: any = { encrypt: jest.fn().mockReturnValue('encrypted-admin-payload') };
    const config: any = { get: jest.fn().mockReturnValue('ops@example.test') };
    const service = new MailOutboxService({} as any, encryption, {} as any, config);
    await service.queueSupportAdminNotification(tx, 'user-1', 'Login help', 'message-2');
    expect(tx.mailOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [expect.objectContaining({ userId: 'user-1', dedupeKey: 'support-admin:message-2', payloadEnc: 'encrypted-admin-payload' })],
    }));

    const noInboxTx: any = { mailOutbox: { createMany: jest.fn() } };
    const noInbox = new MailOutboxService({} as any, encryption, {} as any, { get: jest.fn().mockReturnValue('') } as any);
    await noInbox.queueSupportAdminNotification(noInboxTx, 'user-1', 'Login help', 'message-3');
    expect(noInboxTx.mailOutbox.createMany).not.toHaveBeenCalled();
  });

  it('lists bounded redacted mail-outbox metadata for operators', async () => {
    const prisma: any = {
      mailOutbox: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'FAILED', _count: { _all: 2 } },
          { status: 'PENDING', _count: { _all: 3 } },
        ]),
        findMany: jest.fn().mockResolvedValue([{
          id: 'mail-1', dedupeKey: 'support-reply:private-message-id', status: 'FAILED', attempts: 8,
          nextAttemptAt: new Date(), expiresAt: new Date(), sentAt: null, failedAt: new Date(),
          createdAt: new Date(), lastError: 'untrusted raw exception with address@example.test',
        }]),
      },
    };
    const service = new MailOutboxService(prisma, {} as any, {} as any, {} as any);

    const result = await service.listForAdmin(1);

    expect(result.counts).toMatchObject({ PENDING: 3, FAILED: 2, SENT: 0 });
    expect(result.messages[0]).toMatchObject({ category: 'support-reply', status: 'FAILED', errorCode: 'other' });
    expect(JSON.stringify(result)).not.toContain('private-message-id');
    expect(JSON.stringify(result)).not.toContain('address@example.test');
    expect(prisma.mailOutbox.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 51,
      skip: 0,
      where: { status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } },
      select: expect.not.objectContaining({ userId: true, payloadEnc: true }),
    }));
  });

  it('delivers a current verification code and marks the outbox row sent', async () => {
    const code = '123456';
    const row = {
      id: 'mail-1', userId: 'user-1', status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000), payloadEnc: JSON.stringify({ kind: 'verification', to: 'creator@example.test', code }),
    };
    const user = {
      email: 'creator@example.test', isVerified: false, deletionRequestedAt: null,
      otpCode: createHmac('sha256', secret).update(code).digest('hex'), otpExpires: new Date(Date.now() + 5 * 60_000), otpAttempts: 0,
    };
    const { service, mail, prisma } = setup(row, user);

    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 1, retried: 0, failed: 0, canceled: 0 });

    expect(mail.sendVerificationEmail).toHaveBeenCalledWith(user.email, code);
    expect(prisma.mailOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: row.id, status: 'PROCESSING', lockedAt: expect.any(Date) }),
      data: expect.objectContaining({ status: 'SENT', sentAt: expect.any(Date) }),
    }));
  });

  it('cancels a stale code so an older queued message cannot be delivered', async () => {
    const row = {
      id: 'mail-2', userId: 'user-1', status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000), payloadEnc: JSON.stringify({ kind: 'verification', to: 'creator@example.test', code: '123456' }),
    };
    const user = {
      email: 'creator@example.test', isVerified: false, deletionRequestedAt: null,
      otpCode: createHmac('sha256', secret).update('654321').digest('hex'), otpExpires: new Date(Date.now() + 5 * 60_000), otpAttempts: 0,
    };
    const { service, mail, prisma } = setup(row, user);

    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 0, retried: 0, failed: 0, canceled: 1 });

    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    expect(prisma.mailOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'CANCELLED', lastError: 'action_no_longer_current', lockedAt: null }),
    }));
  });

  it('schedules bounded retry after mail delivery failure', async () => {
    const row = {
      id: 'mail-3', userId: 'user-1', status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000), payloadEnc: JSON.stringify({ kind: 'welcome', to: 'creator@example.test', name: 'Creator' }),
    };
    const user = { email: row && 'creator@example.test', isVerified: true, deletionRequestedAt: null };
    const { service, prisma } = setup(row, user, false);

    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 0, retried: 1, failed: 0, canceled: 0 });

    const retry = prisma.mailOutbox.updateMany.mock.calls[1][0].data;
    expect(retry.status).toBe('PENDING');
    expect(retry.lastError).toBe('delivery_failed');
    expect(retry.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('stops retrying after the configured attempt limit', async () => {
    const row = {
      id: 'mail-4', userId: 'user-1', status: 'PENDING', attempts: 7, lockedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000), payloadEnc: JSON.stringify({ kind: 'welcome', to: 'creator@example.test', name: 'Creator' }),
    };
    const { service, prisma } = setup(row, { email: 'creator@example.test', isVerified: true, deletionRequestedAt: null }, false);

    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 0, retried: 0, failed: 1, canceled: 0 });

    expect(prisma.mailOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED', lastError: 'delivery_failed', failedAt: expect.any(Date) }),
    }));
  });

  it('does not exceed the attempt limit after repeated worker lease expiry', async () => {
    const row = {
      id: 'mail-7', userId: 'user-1', status: 'PROCESSING', attempts: 8, lockedAt: new Date(Date.now() - 6 * 60_000),
      expiresAt: new Date(Date.now() + 10 * 60_000), payloadEnc: JSON.stringify({ kind: 'welcome', to: 'creator@example.test', name: 'Creator' }),
    };
    const { service, mail, prisma } = setup(row, { email: 'creator@example.test', isVerified: true, deletionRequestedAt: null });

    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 0, retried: 0, failed: 1, canceled: 0 });

    expect(mail.sendTrialWelcomeEmail).not.toHaveBeenCalled();
    expect(prisma.mailOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED', lastError: 'attempt_limit_reached' }),
    }));
  });

  it('skips a row another worker has already claimed', async () => {
    const row = {
      id: 'mail-8', userId: 'user-1', status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000), payloadEnc: JSON.stringify({ kind: 'welcome', to: 'creator@example.test', name: 'Creator' }),
    };
    const { service, mail, prisma } = setup(row, { email: 'creator@example.test', isVerified: true, deletionRequestedAt: null });
    prisma.mailOutbox.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.processPending()).resolves.toEqual({ processed: 0, sent: 0, retried: 0, failed: 0, canceled: 0 });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mail.sendTrialWelcomeEmail).not.toHaveBeenCalled();
  });

  it('cancels expired messages without reading the token or calling SMTP', async () => {
    const row = {
      id: 'mail-5', userId: 'user-1', status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt: new Date(Date.now() - 1000), payloadEnc: 'must-not-be-decrypted',
    };
    const { service, prisma, mail, encryption } = setup(row, null);

    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 0, retried: 0, failed: 0, canceled: 1 });

    expect(encryption.decrypt).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    expect(prisma.mailOutbox.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'CANCELLED', lastError: 'expired' }),
    }));
  });

  it('sends a current password-reset token after validating its stored hash', async () => {
    const token = 'a'.repeat(64);
    const row = {
      id: 'mail-6', userId: 'user-1', status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000), payloadEnc: JSON.stringify({ kind: 'password-reset', to: 'creator@example.test', token }),
    };
    const user = {
      email: 'creator@example.test', isVerified: true, deletionRequestedAt: null,
      passwordResetTokenHash: createHash('sha256').update(token).digest('hex'),
      passwordResetExpiresAt: new Date(Date.now() + 5 * 60_000),
    };
    const { service, mail } = setup(row, user);

    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 1, retried: 0, failed: 0, canceled: 0 });

    expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(user.email, token);
  });

  it('notifies a verified user about a support reply without sending the message body', async () => {
    const row = {
      id: 'mail-support', userId: 'user-1', status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      payloadEnc: JSON.stringify({ kind: 'support-reply', to: 'creator@example.test', subject: 'Login help' }),
    };
    const { service, mail } = setup(row, { email: 'creator@example.test', isVerified: true, deletionRequestedAt: null });

    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 1, retried: 0, failed: 0, canceled: 0 });

    expect(mail.sendSupportReplyEmail).toHaveBeenCalledWith('creator@example.test', 'Login help');
    expect(JSON.stringify(mail.sendSupportReplyEmail.mock.calls)).not.toContain('message body');
  });

  it('sends support operations alerts only to the currently configured inbox', async () => {
    const row = {
      id: 'mail-admin-support', userId: 'user-1', status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      payloadEnc: JSON.stringify({ kind: 'support-admin', to: 'ops@example.test', subject: 'Login help' }),
    };
    const { service, mail } = setup(row, { email: 'creator@example.test', isVerified: true, deletionRequestedAt: null }, true, 'ops@example.test');
    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 1, retried: 0, failed: 0, canceled: 0 });
    expect(mail.sendSupportAdminNotificationEmail).toHaveBeenCalledWith('ops@example.test', 'Login help');

    const changedConfig = setup(row, { email: 'creator@example.test', isVerified: true, deletionRequestedAt: null }, true, 'other@example.test');
    await expect(changedConfig.service.processPending()).resolves.toEqual({ processed: 1, sent: 0, retried: 0, failed: 0, canceled: 1 });
    expect(changedConfig.mail.sendSupportAdminNotificationEmail).not.toHaveBeenCalled();
  });

  it('sends contact replies only when the encrypted payload still matches the stored enquiry thread', async () => {
    const enquiryId = '11111111-1111-4111-8111-111111111111';
    const messageId = '22222222-2222-4222-8222-222222222222';
    const row = {
      id: 'mail-contact', userId: null, contactEnquiryMessageId: messageId, status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      payloadEnc: JSON.stringify({ kind: 'contact-reply', to: 'creator@example.test', name: 'Creator', subject: 'Question',
        body: 'Thanks for contacting us.', enquiryId, messageId }),
    };
    const { service, mail, prisma } = setup(row, null);
    prisma.contactEnquiryMessage.findUnique.mockResolvedValueOnce({ kind: 'ADMIN_REPLY', body: 'Thanks for contacting us.', enquiryId, authorAdminId: 'admin-1',
      enquiry: { email: 'creator@example.test', name: 'Creator', subject: 'Question', status: 'IN_PROGRESS' } });
    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 1, retried: 0, failed: 0, canceled: 0 });
    expect(mail.sendContactReplyEmail).toHaveBeenCalledWith('creator@example.test', 'Creator', 'Question', 'Thanks for contacting us.');
    expect(prisma.contactEnquiryMessage.updateMany).toHaveBeenCalledWith({ where: { id: messageId }, data: { emailDeliveryStatus: 'SENT' } });
  });

  it('sends a still-valid admin invite only while its one-use token remains active', async () => {
    const token = 'b'.repeat(43);
    const invitationId = '77a84c10-5c25-4d1c-a15d-c3832348e482';
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const row = {
      id: 'mail-invitation', userId: null, status: 'PENDING', attempts: 0, lockedAt: null,
      expiresAt,
      payloadEnc: JSON.stringify({ kind: 'admin-invitation', to: 'new-admin@example.test', invitationId, token, expiresAt: expiresAt.toISOString() }),
    };
    const { service, prisma, mail } = setup(row, null);
    prisma.adminInvitation.findUnique.mockResolvedValue({
      email: 'new-admin@example.test', tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt, acceptedAt: null, revokedAt: null,
    });
    await expect(service.processPending()).resolves.toEqual({ processed: 1, sent: 1, retried: 0, failed: 0, canceled: 0 });
    expect(mail.sendAdminInvitationEmail).toHaveBeenCalledWith('new-admin@example.test', token, expiresAt);
  });
});
