import { Inject, Injectable, BadRequestException, UnauthorizedException, NotFoundException, ConflictException, Optional } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { createHash, randomBytes } from 'node:crypto';
import { DM_QUEUE_TOKEN } from '../queue/queue.constants';
import { dmQueueJobId } from '../queue/queue.constants';
import { ConfigService } from '@nestjs/config';

const DELETION_GRACE_MS = 15 * 60_000;
const REMOVABLE_JOB_STATES = ['waiting', 'delayed', 'paused', 'waiting-children', 'prioritized', 'completed', 'failed'] as const;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(DM_QUEUE_TOKEN) private dmQueue?: Queue,
    @Optional() private config?: ConfigService,
  ) {}

  async requestAccountDeletion(userId: string, currentPassword: string, confirmationEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, deletionRequestedAt: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    if (user.deletionRequestedAt) throw new ConflictException('Account deletion is already in progress.');
    if (confirmationEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException('Enter your account email to confirm deletion.');
    }
    if (!(await bcrypt.compare(currentPassword ?? '', user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const requestedAt = new Date();
    const tombstoneEmail = `deleted-${user.id}@account.invalid`;
    const erasedPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    await this.prisma.$transaction(async (tx) => {
      const publicProfile = await tx.publicProfile.findUnique({ where: { userId }, select: { id: true, avatarAssetId: true } });
      if (publicProfile) {
        await tx.publicProfile.update({
          where: { id: publicProfile.id },
          data: { visibility: 'PRIVATE', avatarAssetId: null, avatarDeliveryUrl: null },
        });
        if (publicProfile.avatarAssetId) await tx.profileAssetDeletion.upsert({
          where: { assetId: publicProfile.avatarAssetId },
          create: { assetId: publicProfile.avatarAssetId },
          update: { nextAttemptAt: requestedAt },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          deletionRequestedAt: requestedAt,
          email: tombstoneEmail,
          passwordHash: erasedPasswordHash,
          name: 'Deleted account',
          profilePicUrl: null,
          role: 'INFLUENCER',
          isVerified: false,
          otpCode: null,
          otpExpires: null,
          otpAttempts: 0,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          plan: 'FREE',
          planExpiresAt: null,
          trialEndsAt: null,
          trialReminderSent: false,
          dmCount: 0,
          dmCountResetAt: null,
        },
      });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.igAccount.updateMany({ where: { userId }, data: { isActive: false, accessTokenEnc: '' } });
      await tx.automation.updateMany({ where: { igAccount: { userId } }, data: { status: 'PAUSED' } });
    });

    return { requestedAt, scheduledFor: new Date(requestedAt.getTime() + DELETION_GRACE_MS) };
  }

  async scheduleExpiredUnverifiedAccountDeletions(now = new Date()): Promise<number> {
    const retentionDays = this.config?.get<number>('UNVERIFIED_ACCOUNT_RETENTION_DAYS', 30) ?? 30;
    const createdBefore = new Date(now.getTime() - retentionDays * 24 * 60 * 60_000);
    const expired = await this.prisma.user.findMany({
      where: {
        isVerified: false,
        role: { notIn: ['ADMIN', 'SUPER_ADMIN'] },
        deletionRequestedAt: null,
        createdAt: { lte: createdBefore },
      },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
    });
    if (expired.length === 0) return 0;

    const erasedPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    let scheduled = 0;
    for (const account of expired) {
      const claimed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.user.updateMany({
          where: {
            id: account.id,
            isVerified: false,
            role: { notIn: ['ADMIN', 'SUPER_ADMIN'] },
            deletionRequestedAt: null,
            createdAt: { lte: createdBefore },
          },
          data: {
            deletionRequestedAt: now,
            email: `deleted-${account.id}@account.invalid`,
            passwordHash: erasedPasswordHash,
            name: 'Deleted account',
            profilePicUrl: null,
            role: 'INFLUENCER',
            otpCode: null,
            otpExpires: null,
            otpAttempts: 0,
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
            plan: 'FREE',
            planExpiresAt: null,
            trialEndsAt: null,
            trialReminderSent: false,
            dmCount: 0,
            dmCountResetAt: null,
          },
        });
        if (updated.count !== 1) return false;
        await tx.refreshToken.deleteMany({ where: { userId: account.id } });
        await tx.igAccount.updateMany({
          where: { userId: account.id },
          data: { isActive: false, accessTokenEnc: '', tokenExpiresAt: null, lastAlertAt: null },
        });
        await tx.automation.updateMany({ where: { igAccount: { userId: account.id } }, data: { status: 'PAUSED' } });
        return true;
      });
      if (claimed) scheduled++;
    }
    return scheduled;
  }

  async processPendingAccountDeletions(now = new Date()): Promise<number> {
    if (!this.dmQueue) throw new Error('DM queue is unavailable for account deletion cleanup.');
    const cutoff = new Date(now.getTime() - DELETION_GRACE_MS);
    const candidates = await this.prisma.user.findMany({
      where: { deletionRequestedAt: { lte: cutoff } },
      select: { id: true, igAccounts: { select: { id: true, igUserId: true } } },
      take: 50,
      orderBy: { deletionRequestedAt: 'asc' },
    });

    let deleted = 0;
    for (const user of candidates) {
      const accountIds = user.igAccounts.map((account) => account.id);
      const igUserIds = user.igAccounts.map((account) => account.igUserId);
      const eventOwnership = accountIds.length
        ? [
          { igAccountId: { in: accountIds } },
          { igUserId: { in: igUserIds } },
        ]
        : [];
      const events = eventOwnership.length
        ? await this.prisma.webhookEvent.findMany({
          where: { OR: eventOwnership },
          select: { id: true, eventId: true },
        })
        : [];
      const primaryRuns = accountIds.length
        ? await this.prisma.run.findMany({
          where: { igAccountId: { in: accountIds }, followUpOrder: null },
          select: { triggerEventId: true, status: true },
        })
        : [];
      const followUps = accountIds.length
        ? await this.prisma.followUp.findMany({
          where: { automation: { igAccountId: { in: accountIds } } },
          select: { id: true },
        })
        : [];

      const eventIds = new Set(events.map((event) => event.id));
      const activeJobs = await this.dmQueue.getJobs(['active'], 0, -1, false);
      const hasActiveAccountJob = activeJobs.some((job) =>
        (job.name === 'send' && accountIds.includes(job.data?.igAccountId))
        || (job.name === 'process-webhook-event' && eventIds.has(job.data?.webhookEventId)),
      );
      if (hasActiveAccountJob) continue;

      const jobIds = new Set<string>();
      for (const event of events) {
        jobIds.add(`wh-${createHash('sha256').update(event.eventId).digest('hex')}`);
        jobIds.add(event.eventId); // legacy primary send ID
        jobIds.add(dmQueueJobId(event.eventId));
      }
      for (const run of primaryRuns) {
        jobIds.add(run.triggerEventId); // legacy primary/follow-up ID
        jobIds.add(dmQueueJobId(run.triggerEventId));
        if (run.status === 'SENT') {
          for (const followUp of followUps) {
            const followUpEventId = `${run.triggerEventId}:fu:${followUp.id}`;
            jobIds.add(followUpEventId); // legacy follow-up ID
            jobIds.add(dmQueueJobId(followUpEventId));
          }
        }
      }

      let queueIsClear = true;
      for (const id of jobIds) {
        const job = await this.dmQueue.getJob(id);
        if (!job) continue;
        const state = await job.getState();
        if (state === 'active') {
          queueIsClear = false;
          break;
        }
        if ((REMOVABLE_JOB_STATES as readonly string[]).includes(state)) {
          try {
            await job.remove();
          } catch {
            const current = await this.dmQueue.getJob(id);
            if (current && await current.getState() === 'active') {
              queueIsClear = false;
              break;
            }
            if (current) {
              queueIsClear = false;
              break;
            }
          }
        }
      }
      if (!queueIsClear) continue;

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({ where: { userId: user.id }, data: { userId: null } });
        await tx.dmQuotaReservation.deleteMany({ where: { userId: user.id } });
        if (eventOwnership.length) await tx.webhookEvent.deleteMany({ where: { OR: eventOwnership } });
        return tx.user.deleteMany({ where: { id: user.id, deletionRequestedAt: { lte: cutoff } } });
      });
      deleted += result.count;
    }
    return deleted;
  }

  async exportData(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true, name: true, profilePicUrl: true, role: true, isVerified: true,
          termsVersion: true, termsAcceptedAt: true, privacyVersion: true, privacyAcknowledgedAt: true, ageConfirmedAt: true,
          plan: true, planExpiresAt: true, trialEndsAt: true, dmCount: true, dmCountResetAt: true,
          createdAt: true, updatedAt: true,
        },
      });
      if (!account) throw new NotFoundException('User not found.');

      const [igAccounts, automations, contacts, runs, payments, clicks, supportRequests] = await Promise.all([
        tx.igAccount.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, igUserId: true, username: true, pageId: true, isActive: true,
            tokenExpiresAt: true, lastAlertAt: true, createdAt: true, updatedAt: true,
          },
        }),
        tx.automation.findMany({
          where: { igAccount: { userId } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true, igAccountId: true, name: true, triggerType: true, mediaId: true, matchMode: true,
            keywords: true, publicReplies: true, replyToComment: true, askToFollow: true, collectEmail: true,
            trackClicks: true, dmBlocks: true, status: true, dailyLimit: true, dailyCount: true,
            dailyCountResetAt: true, createdAt: true, updatedAt: true,
            followUps: {
              orderBy: { order: 'asc' },
              select: { id: true, order: true, condition: true, delayMinutes: true, dmBlocks: true },
            },
            trackedLinks: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, slug: true, targetUrl: true, clicks: true, createdAt: true },
            },
          },
        }),
        tx.contact.findMany({
          where: { igAccount: { userId } },
          orderBy: [{ firstInteraction: 'asc' }, { id: 'asc' }],
          select: {
            id: true, igAccountId: true, igScopedId: true, username: true, name: true, email: true,
            notes: true, tags: true,
            follows: true, dmsSent: true, firstInteraction: true, lastInteraction: true, lastReplyAt: true,
          },
        }),
        tx.run.findMany({
          where: { igAccount: { userId } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true, automationId: true, igAccountId: true, contactId: true, triggerEventId: true,
            followUpOrder: true, status: true, error: true, createdAt: true, sentAt: true,
          },
        }),
        tx.payment.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
          select: { orderId: true, paymentId: true, plan: true, amount: true, currency: true, createdAt: true },
        }),
        tx.click.findMany({
          where: { trackedLink: { automation: { igAccount: { userId } } } },
          orderBy: [{ clickedAt: 'asc' }, { id: 'asc' }],
          select: { trackedLinkId: true, contactIgsid: true, clickedAt: true },
        }),
        tx.supportRequest.findMany({
          where: { userId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true, type: true, status: true, subject: true, rating: true, createdAt: true, updatedAt: true,
            messages: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: { id: true, senderType: true, body: true, createdAt: true },
            },
          },
        }),
      ]);

      return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        account,
        instagramAccounts: igAccounts,
        automations,
        contacts,
        deliveryRuns: runs,
        payments,
        clickEvents: clicks,
        supportRequests,
        excluded: ['Passwords and authentication tokens', 'Instagram access-token ciphertext', 'Raw Meta webhook payloads'],
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private contactWhere(userId: string, accountId?: string, search?: string): Prisma.ContactWhereInput {
    return {
      igAccount: { userId, ...(accountId ? { id: accountId } : {}) },
      ...(search ? { username: { contains: search, mode: 'insensitive' } } : {}),
    };
  }

  async updateContact(userId: string, contactId: string, input: { notes: string; tags: string[] }) {
    const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean).map((tag) => tag.slice(0, 24)))].slice(0, 10);
    const updated = await this.prisma.contact.updateMany({
      where: { id: contactId, igAccount: { userId } },
      data: { notes: input.notes.trim(), tags },
    });
    if (updated.count !== 1) throw new NotFoundException('Contact not found.');
    return this.prisma.contact.findFirst({
      where: { id: contactId, igAccount: { userId } },
      select: { id: true, notes: true, tags: true },
    });
  }

  async listContacts(userId: string, options: { page: number; pageSize: number; accountId?: string; search?: string }) {
    const where = this.contactWhere(userId, options.accountId, options.search);
    const [total, contacts, accounts] = await this.prisma.$transaction([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        orderBy: [{ lastInteraction: 'desc' }, { id: 'asc' }],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        select: {
          id: true,
          username: true,
          notes: true,
          tags: true,
          follows: true,
          dmsSent: true,
          firstInteraction: true,
          lastInteraction: true,
          igAccount: { select: { id: true, username: true } },
        },
      }),
      this.prisma.igAccount.findMany({
        where: { userId },
        orderBy: { username: 'asc' },
        select: { id: true, username: true },
      }),
    ]);
    return {
      contacts,
      accounts,
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        total,
        totalPages: Math.ceil(total / options.pageSize),
      },
    };
  }

  async *streamContactsCsv(userId: string, options: { accountId?: string; search?: string }) {
    const where = this.contactWhere(userId, options.accountId, options.search);
    yield 'instagram_username,instagram_account,first_interaction,last_interaction,successful_dms,follows,notes,tags\r\n';
    let cursor: string | undefined;
    while (true) {
      const batch = await this.prisma.contact.findMany({
        where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: 'asc' },
        take: 500,
        select: {
          id: true,
          username: true,
          notes: true,
          tags: true,
          follows: true,
          dmsSent: true,
          firstInteraction: true,
          lastInteraction: true,
          igAccount: { select: { username: true } },
        },
      });
      if (batch.length === 0) break;
      for (const contact of batch) {
        const values = [
          contact.username ? `@${contact.username}` : '',
          `@${contact.igAccount.username}`,
          contact.firstInteraction.toISOString(),
          contact.lastInteraction.toISOString(),
          String(contact.dmsSent),
          contact.follows ? 'true' : 'false',
          contact.notes,
          contact.tags.join('|'),
        ];
        yield `${values.map(csvCell).join(',')}\r\n`;
      }
      cursor = batch[batch.length - 1].id;
    }
  }

  async updateProfile(userId: string, name?: string) {
    const clean = (name ?? '').trim();
    if (!clean || clean.length < 2) throw new BadRequestException('Name must be at least 2 characters.');
    if (clean.length > 80) throw new BadRequestException('Name is too long.');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: clean },
      select: { id: true, name: true, email: true, isVerified: true },
    });
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters.');
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      throw new BadRequestException('New password must include an uppercase letter, a number, and a special character.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const ok = await bcrypt.compare(currentPassword ?? '', user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect.');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    return { success: true };
  }
}

function csvCell(value: string) {
  // Prefix spreadsheet formula markers to prevent CSV formula injection.
  const safe = /^[\t\r ]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
