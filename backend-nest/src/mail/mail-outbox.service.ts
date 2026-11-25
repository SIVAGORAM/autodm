import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { EncryptionService } from '../common/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';

type MailPayload =
  | { kind: 'verification'; to: string; code: string }
  | { kind: 'password-reset'; to: string; token: string }
  | { kind: 'welcome'; to: string; name: string }
  | { kind: 'support-reply'; to: string; subject: string }
  | { kind: 'support-admin'; to: string; subject: string }
  | { kind: 'contact-admin'; to: string; enquiryId: string; subject: string }
  | { kind: 'contact-reply'; to: string; enquiryId: string; messageId: string; name: string; subject: string; body: string }
  | { kind: 'admin-invitation'; to: string; invitationId: string; token: string; expiresAt: string };

const MAX_ATTEMPTS = 8;
const RETRY_DELAYS_MS = [60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000, 20 * 60_000, 30 * 60_000, 60 * 60_000];
const PROCESSING_LEASE_MS = 5 * 60_000;
const BATCH_SIZE = 5;
const TERMINAL_STATUSES = ['SENT', 'FAILED', 'CANCELLED'];
const ADMIN_MAIL_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'] as const;
type AdminMailStatus = (typeof ADMIN_MAIL_STATUSES)[number];

@Injectable()
export class MailOutboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(MailOutboxService.name);
  private drainTimer: NodeJS.Timeout | null = null;
  private activeDrain: Promise<any> | null = null;

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    // Keep outbox processing running in-process for single-service deployments (e.g. Render free tier)
    this.drainTimer = setInterval(() => {
      this.triggerDrain();
    }, 10_000);
    this.drainTimer.unref();
  }

  onApplicationShutdown() {
    if (this.drainTimer) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
  }

  /** Triggers immediate asynchronous processing of pending outbox items without blocking the caller */
  triggerDrain() {
    if (this.activeDrain || process.env.NODE_ENV === 'test') return;
    setImmediate(() => {
      this.activeDrain = this.processPending()
        .then((res) => {
          if (res.sent > 0 || res.failed > 0) {
            this.log.log(`Mail outbox processed: sent=${res.sent} retried=${res.retried} failed=${res.failed}`);
          }
        })
        .catch((err) => {
          this.log.warn(`Mail outbox drain error: ${err?.message || 'unknown error'}`);
        })
        .finally(() => {
          this.activeDrain = null;
        });
    });
  }

  async queueVerification(tx: Prisma.TransactionClient, userId: string, to: string, code: string, expiresAt: Date) {
    const payload: MailPayload = { kind: 'verification', to, code };
    await tx.mailOutbox.create({
      data: {
        userId,
        dedupeKey: `verification:${userId}:${expiresAt.getTime()}`,
        payloadEnc: this.encryption.encrypt(JSON.stringify(payload)),
        expiresAt,
      },
    });
    this.triggerDrain();
  }

  async queuePasswordReset(tx: Prisma.TransactionClient, userId: string, to: string, token: string, expiresAt: Date) {
    const payload: MailPayload = { kind: 'password-reset', to, token };
    await tx.mailOutbox.create({
      data: {
        userId,
        dedupeKey: `password-reset:${userId}:${randomUUID()}`,
        payloadEnc: this.encryption.encrypt(JSON.stringify(payload)),
        expiresAt,
      },
    });
    this.triggerDrain();
  }

  async queueWelcome(tx: Prisma.TransactionClient, userId: string, to: string, name: string, expiresAt: Date) {
    const payload: MailPayload = { kind: 'welcome', to, name };
    await tx.mailOutbox.createMany({
      data: [{
        userId,
        dedupeKey: `welcome:${userId}`,
        payloadEnc: this.encryption.encrypt(JSON.stringify(payload)),
        expiresAt,
      }],
      skipDuplicates: true,
    });
    this.triggerDrain();
  }

  async queueSupportReply(tx: Prisma.TransactionClient, userId: string, to: string, subject: string, messageId: string) {
    const payload: MailPayload = { kind: 'support-reply', to, subject };
    await tx.mailOutbox.createMany({
      data: [{
        userId,
        dedupeKey: `support-reply:${messageId}`,
        payloadEnc: this.encryption.encrypt(JSON.stringify(payload)),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      }],
      skipDuplicates: true,
    });
    this.triggerDrain();
  }

  private getSupportNotificationEmail(): string | undefined {
    return this.config.get<string>('SUPPORT_NOTIFICATION_EMAIL')?.trim()
      || this.config.get<string>('EMAIL_TO')?.trim();
  }

  async queueSupportAdminNotification(tx: Prisma.TransactionClient, userId: string, subject: string, messageId: string) {
    const to = this.getSupportNotificationEmail();
    if (!to) return;
    const payload: MailPayload = { kind: 'support-admin', to, subject };
    await tx.mailOutbox.createMany({
      data: [{
        userId,
        dedupeKey: `support-admin:${messageId}`,
        payloadEnc: this.encryption.encrypt(JSON.stringify(payload)),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      }],
      skipDuplicates: true,
    });
    this.triggerDrain();
  }

  async queueContactEnquiryNotification(tx: Prisma.TransactionClient, enquiryId: string, subject: string) {
    const to = this.getSupportNotificationEmail();
    if (!to) return;
    const payload: MailPayload = { kind: 'contact-admin', to, enquiryId, subject };
    await tx.mailOutbox.createMany({
      data: [{
        dedupeKey: `contact-admin:${enquiryId}`,
        payloadEnc: this.encryption.encrypt(JSON.stringify(payload)),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      }],
      skipDuplicates: true,
    });
    this.triggerDrain();
  }

  async queueContactReply(tx: Prisma.TransactionClient, input: {
    enquiryId: string; messageId: string; to: string; name: string; subject: string; body: string;
  }) {
    const payload: MailPayload = { kind: 'contact-reply', ...input };
    await tx.mailOutbox.createMany({
      data: [{
        contactEnquiryMessageId: input.messageId,
        dedupeKey: `contact-reply:${input.messageId}`,
        payloadEnc: this.encryption.encrypt(JSON.stringify(payload)),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      }],
      skipDuplicates: true,
    });
    this.triggerDrain();
  }

  async queueAdminInvitation(tx: Prisma.TransactionClient, input: {
    invitationId: string; to: string; token: string; expiresAt: Date;
  }) {
    const payload: MailPayload = {
      kind: 'admin-invitation', to: input.to, invitationId: input.invitationId,
      token: input.token, expiresAt: input.expiresAt.toISOString(),
    };
    await tx.mailOutbox.create({
      data: {
        dedupeKey: `admin-invitation:${input.invitationId}`,
        payloadEnc: this.encryption.encrypt(JSON.stringify(payload)),
        expiresAt: input.expiresAt,
      },
    });
    this.triggerDrain();
  }

  async processPending(): Promise<{ processed: number; sent: number; retried: number; failed: number; canceled: number }> {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const candidates = await this.prisma.mailOutbox.findMany({
      where: {
        OR: [
          { status: 'PENDING', OR: [{ nextAttemptAt: { lte: now } }, { expiresAt: { lte: now } }] },
          { status: 'PROCESSING', lockedAt: { lte: staleBefore } },
        ],
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      take: BATCH_SIZE,
    });

    const outcome = { processed: 0, sent: 0, retried: 0, failed: 0, canceled: 0 };
    for (const row of candidates) {
      const lockAt = new Date();
      const claim = row.status === 'PENDING'
        ? await this.prisma.mailOutbox.updateMany({
          where: { id: row.id, status: 'PENDING', OR: [{ nextAttemptAt: { lte: now } }, { expiresAt: { lte: now } }] },
          data: { status: 'PROCESSING', lockedAt: lockAt, attempts: { increment: 1 } },
        })
        : await this.prisma.mailOutbox.updateMany({
          where: { id: row.id, status: 'PROCESSING', lockedAt: row.lockedAt },
          data: { lockedAt: lockAt, attempts: { increment: 1 } },
        });
      if (claim.count !== 1) continue;

      const attempts = row.attempts + 1;
      if (row.expiresAt <= lockAt) {
        await this.finish(row.id, lockAt, { status: 'CANCELLED', lastError: 'expired' }, row.contactEnquiryMessageId);
        outcome.processed++;
        outcome.canceled++;
        continue;
      }
      if (attempts > MAX_ATTEMPTS) {
        await this.finish(row.id, lockAt, { status: 'FAILED', failedAt: lockAt, lastError: 'attempt_limit_reached' }, row.contactEnquiryMessageId);
        outcome.processed++;
        outcome.failed++;
        continue;
      }

      let payload: MailPayload;
      try {
        payload = this.parsePayload(this.encryption.decrypt(row.payloadEnc));
      } catch {
        await this.finish(row.id, lockAt, { status: 'FAILED', failedAt: lockAt, lastError: 'payload_invalid' }, row.contactEnquiryMessageId);
        outcome.processed++;
        outcome.failed++;
        continue;
      }

      if (!(await this.isCurrent(row.userId, payload, lockAt))) {
        await this.finish(row.id, lockAt, { status: 'CANCELLED', lastError: 'action_no_longer_current' }, row.contactEnquiryMessageId);
        outcome.processed++;
        outcome.canceled++;
        continue;
      }

      const sent = await this.deliver(payload);
      if (sent) {
        await this.finish(row.id, lockAt, { status: 'SENT', sentAt: new Date(), lastError: null }, row.contactEnquiryMessageId);
        outcome.sent++;
      } else {
        const delay = RETRY_DELAYS_MS[Math.min(attempts - 1, RETRY_DELAYS_MS.length - 1)];
        const nextAttemptAt = new Date(Date.now() + delay);
        if (attempts >= MAX_ATTEMPTS || nextAttemptAt >= row.expiresAt) {
          await this.finish(row.id, lockAt, { status: 'FAILED', failedAt: new Date(), lastError: 'delivery_failed' }, row.contactEnquiryMessageId);
          outcome.failed++;
        } else {
          await this.finish(row.id, lockAt, { status: 'PENDING', nextAttemptAt, lastError: 'delivery_failed' }, row.contactEnquiryMessageId);
          outcome.retried++;
        }
      }
      outcome.processed++;
    }
    return outcome;
  }

  async purgeTerminal(retentionDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - Math.max(1, Math.min(retentionDays, 365)) * 24 * 60 * 60 * 1000);
    const result = await this.prisma.mailOutbox.deleteMany({
      where: { status: { in: TERMINAL_STATUSES }, createdAt: { lt: cutoff } },
    });
    return result.count;
  }

  async listForAdmin(page = 1, status?: AdminMailStatus) {
    const pageSize = 50;
    const safePage = Math.min(Math.max(Math.trunc(page) || 1, 1), 100_000);
    const where: Prisma.MailOutboxWhereInput = status
      ? { status }
      : { status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } };
    const [groups, rows] = await Promise.all([
      this.prisma.mailOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.mailOutbox.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: pageSize + 1,
        skip: (safePage - 1) * pageSize,
        select: {
          id: true, dedupeKey: true, status: true, attempts: true,
          nextAttemptAt: true, expiresAt: true, sentAt: true, failedAt: true,
          createdAt: true, lastError: true,
        },
      }),
    ]);
    const counts = Object.fromEntries(ADMIN_MAIL_STATUSES.map((key) => [key, 0])) as Record<AdminMailStatus, number>;
    for (const group of groups) {
      if (ADMIN_MAIL_STATUSES.includes(group.status as AdminMailStatus)) {
        counts[group.status as AdminMailStatus] = group._count._all;
      }
    }
    return {
      counts,
      page: safePage,
      messages: rows.slice(0, pageSize).map((row) => ({
        id: row.id,
        category: this.mailCategory(row.dedupeKey),
        status: ADMIN_MAIL_STATUSES.includes(row.status as AdminMailStatus) ? row.status : 'UNKNOWN',
        attempts: row.attempts,
        nextAttemptAt: row.nextAttemptAt,
        expiresAt: row.expiresAt,
        sentAt: row.sentAt,
        failedAt: row.failedAt,
        createdAt: row.createdAt,
        errorCode: this.safeMailErrorCode(row.lastError),
      })),
      hasMore: rows.length > pageSize,
    };
  }

  private mailCategory(dedupeKey: string): string {
    const prefix = dedupeKey.slice(0, dedupeKey.indexOf(':'));
    return ['verification', 'password-reset', 'welcome', 'support-reply', 'support-admin', 'contact-reply', 'contact-admin'].includes(prefix)
      ? prefix
      : 'other';
  }

  private safeMailErrorCode(error: string | null): string | null {
    if (!error) return null;
    return ['expired', 'action_no_longer_current', 'payload_invalid', 'attempt_limit_reached', 'delivery_failed'].includes(error)
      ? error
      : 'other';
  }

  private async finish(id: string, lockAt: Date, data: Prisma.MailOutboxUpdateManyMutationInput, contactMessageId?: string | null) {
    await this.prisma.mailOutbox.updateMany({
      where: { id, status: 'PROCESSING', lockedAt: lockAt },
      data: { ...data, lockedAt: null },
    });
    if (contactMessageId) {
      const status = data.status === 'SENT' ? 'SENT'
        : data.status === 'FAILED' ? 'FAILED'
          : data.status === 'CANCELLED' ? 'CANCELLED'
            : data.status === 'PENDING' ? 'QUEUED' : null;
      if (status) await this.prisma.contactEnquiryMessage.updateMany({
        where: { id: contactMessageId }, data: { emailDeliveryStatus: status },
      });
    }
  }

  private parsePayload(raw: string): MailPayload {
    const value = JSON.parse(raw);
    if (!value || typeof value.to !== 'string' || !value.to.includes('@')) throw new Error('invalid payload');
    if (value.kind === 'verification' && /^\d{6}$/.test(value.code)) return value;
    if (value.kind === 'password-reset' && /^[a-f0-9]{64}$/i.test(value.token)) return value;
    if (value.kind === 'welcome' && typeof value.name === 'string') return value;
    if (value.kind === 'support-reply' && typeof value.subject === 'string' && value.subject.length <= 120) return value;
    if (value.kind === 'support-admin' && typeof value.subject === 'string' && value.subject.length <= 120) return value;
    if (value.kind === 'contact-admin' && /^[0-9a-f-]{36}$/i.test(value.enquiryId) && typeof value.subject === 'string' && value.subject.length <= 120) return value;
    if (value.kind === 'contact-reply' && /^[0-9a-f-]{36}$/i.test(value.enquiryId) && /^[0-9a-f-]{36}$/i.test(value.messageId)
      && typeof value.name === 'string' && value.name.length <= 100 && typeof value.subject === 'string' && value.subject.length <= 120
      && typeof value.body === 'string' && value.body.length >= 1 && value.body.length <= 5_000) return value;
    if (value.kind === 'admin-invitation' && /^[0-9a-f-]{36}$/i.test(value.invitationId)
      && /^[A-Za-z0-9_-]{43}$/.test(value.token) && typeof value.expiresAt === 'string'
      && Number.isFinite(Date.parse(value.expiresAt))) return value;
    throw new Error('invalid payload');
  }

  private async isCurrent(userId: string | null, payload: MailPayload, now: Date): Promise<boolean> {
    if (payload.kind === 'admin-invitation') {
      const invitation = await this.prisma.adminInvitation.findUnique({
        where: { id: payload.invitationId },
        select: { email: true, tokenHash: true, expiresAt: true, acceptedAt: true, revokedAt: true },
      });
      const digest = createHash('sha256').update(payload.token).digest('hex');
      return !!invitation && invitation.email === payload.to && invitation.tokenHash === digest
        && invitation.expiresAt > now && invitation.acceptedAt === null && invitation.revokedAt === null;
    }
    if (payload.kind === 'contact-admin') {
      const inbox = this.getSupportNotificationEmail();
      if (!inbox || inbox !== payload.to) return false;
      const enquiry = await this.prisma.contactEnquiry.findUnique({ where: { id: payload.enquiryId }, select: { status: true } });
      return !!enquiry && enquiry.status !== 'SPAM';
    }
    if (payload.kind === 'contact-reply') {
      const message = await this.prisma.contactEnquiryMessage.findUnique({
        where: { id: payload.messageId },
        select: { kind: true, body: true, enquiryId: true, authorAdminId: true,
          enquiry: { select: { email: true, name: true, subject: true, status: true } } },
      });
      return !!message && message.kind === 'ADMIN_REPLY' && !!message.authorAdminId
        && message.enquiryId === payload.enquiryId && message.body === payload.body
        && message.enquiry.email === payload.to && message.enquiry.name === payload.name
        && message.enquiry.subject === payload.subject && message.enquiry.status !== 'SPAM'
        && message.enquiry.status !== 'CLOSED';
    }
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true, isVerified: true, deletionRequestedAt: true,
        otpCode: true, otpExpires: true, otpAttempts: true, passwordResetTokenHash: true, passwordResetExpiresAt: true,
      },
    });
    if (!user || user.deletionRequestedAt) return false;
    if (payload.kind === 'support-admin') {
      const inbox = this.getSupportNotificationEmail();
      return user.isVerified && !!inbox && inbox === payload.to;
    }
    if (user.email !== payload.to) return false;
    if (payload.kind === 'verification') {
      if (user.isVerified || user.otpAttempts >= 5 || !user.otpCode || !user.otpExpires || user.otpExpires <= now) return false;
      const digest = createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET')).update(payload.code).digest();
      const stored = Buffer.from(user.otpCode, 'hex');
      return stored.length === digest.length && timingSafeEqual(stored, digest);
    }
    if (payload.kind === 'password-reset') {
      const digest = createHash('sha256').update(payload.token).digest('hex');
      return !!user.passwordResetTokenHash && user.passwordResetExpiresAt !== null
        && user.passwordResetExpiresAt > now && user.passwordResetTokenHash === digest;
    }
    return user.isVerified;
  }

  private async deliver(payload: MailPayload): Promise<boolean> {
    if (payload.kind === 'verification') return this.mail.sendVerificationEmail(payload.to, payload.code);
    if (payload.kind === 'password-reset') return this.mail.sendPasswordResetEmail(payload.to, payload.token);
    if (payload.kind === 'welcome') return this.mail.sendTrialWelcomeEmail(payload.to, payload.name);
    if (payload.kind === 'support-reply') return this.mail.sendSupportReplyEmail(payload.to, payload.subject);
    if (payload.kind === 'support-admin') return this.mail.sendSupportAdminNotificationEmail(payload.to, payload.subject);
    if (payload.kind === 'contact-admin') return this.mail.sendContactEnquiryNotificationEmail(payload.to, payload.enquiryId, payload.subject);
    if (payload.kind === 'contact-reply') return this.mail.sendContactReplyEmail(payload.to, payload.name, payload.subject, payload.body);
    return this.mail.sendAdminInvitationEmail(payload.to, payload.token, new Date(payload.expiresAt));
  }
}
