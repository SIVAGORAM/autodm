import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Job, Queue } from 'bullmq';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DM_QUEUE_TOKEN } from '../queue/queue.constants';
import { DmJob } from '../queue/queue.constants';

const DISCONNECT_JOB_STATES = ['waiting', 'delayed', 'paused', 'waiting-children', 'prioritized'] as const;
const ACTIVE_JOB_STATES = ['active'] as const;
const DRAIN_TIMEOUT_MS = 15_000;
const JOB_PAGE_SIZE = 500;
const META_DELETION_RECEIPT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class InstagramAccountLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DM_QUEUE_TOKEN) private readonly dmQueue: Queue<DmJob>,
  ) {}

  async disconnect(userId: string, accountId: string) {
    const account = await this.prisma.igAccount.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Account not found.');

    // Stop new webhook matches before touching queued work. The worker checks
    // the automation status before it can use the encrypted provider token.
    await this.prisma.automation.updateMany({
      where: { igAccountId: account.id },
      data: { status: 'PAUSED' },
    });

    await this.drainAccountJobs(
      account.id,
      'Automations are paused while in-progress messages finish. Retry disconnect shortly.',
      'Automations are paused, but queued messages could not be cleared. Retry disconnect when the queue is available.',
    );

    const result = await this.prisma.igAccount.updateMany({
      where: { id: account.id, userId },
      data: { isActive: false, accessTokenEnc: '', tokenExpiresAt: null, webhookSubscribedAt: null, lastAlertAt: null },
    });
    if (!result.count) throw new NotFoundException('Account not found.');
    return { success: true };
  }

  async deleteInstagramData(igUserId: string, requestHash: string): Promise<string> {
    const previous = await this.prisma.metaDataDeletionRequest.findUnique({
      where: { requestHash },
      select: { confirmationCode: true },
    });
    if (previous) return previous.confirmationCode;

    const account = await this.prisma.igAccount.findUnique({ where: { igUserId }, select: { id: true } });
    if (account) {
      // Stop matching and remove the credential first. A callback retry can
      // resume the purge if Redis is down or a send is still active.
      await this.prisma.$transaction(async (tx) => {
        await tx.automation.updateMany({ where: { igAccountId: account.id }, data: { status: 'PAUSED' } });
        await tx.igAccount.updateMany({
          where: { id: account.id, igUserId },
          data: { isActive: false, accessTokenEnc: '', tokenExpiresAt: null, webhookSubscribedAt: null, lastAlertAt: null },
        });
      });
      await this.drainAccountJobs(
        account.id,
        'Instagram data is being deleted after active messages finish. Meta may retry this request shortly.',
        'Instagram data is disabled but could not be fully purged because queued messages could not be cleared. Meta may retry this request.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.metaDataDeletionRequest.findUnique({
          where: { requestHash },
          select: { confirmationCode: true },
        });
        if (existing) return existing.confirmationCode;
        const automations = await tx.automation.findMany({
          where: { igAccount: { igUserId } },
          select: { id: true },
        });
        if (automations.length) {
          await tx.dmQuotaReservation.deleteMany({
            where: { automationId: { in: automations.map((automation) => automation.id) } },
          });
        }
        await tx.webhookEvent.deleteMany({
          where: { OR: [
            ...(account ? [{ igAccountId: account.id }] : []),
            { igUserId },
          ] },
        });
        // Delete by provider-scoped ID inside the same transaction as the
        // receipt. This also removes data if a fresh OAuth callback raced the
        // initial account lookup.
        await tx.igAccount.deleteMany({ where: { igUserId } });
        const receipt = await tx.metaDataDeletionRequest.create({
          data: { requestHash, confirmationCode: randomBytes(24).toString('base64url') },
          select: { confirmationCode: true },
        });
        return receipt.confirmationCode;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existing = await this.prisma.metaDataDeletionRequest.findUnique({
          where: { requestHash },
          select: { confirmationCode: true },
        });
        if (existing) return existing.confirmationCode;
      }
      throw error;
    }
  }

  async deauthorizeInstagramUser(igUserId: string, requestHash: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const previous = await tx.metaDeauthorizationReceipt.findUnique({
          where: { requestHash },
          select: { id: true },
        });
        if (previous) return;
        await tx.metaDeauthorizationReceipt.create({ data: { requestHash } });
        await tx.automation.updateMany({ where: { igAccount: { igUserId } }, data: { status: 'PAUSED' } });
        await tx.igAccount.updateMany({
          where: { igUserId },
          data: { isActive: false, accessTokenEnc: '', tokenExpiresAt: null, webhookSubscribedAt: null, lastAlertAt: null },
        });
      });
    } catch (error: any) {
      if (error?.code === 'P2002') return { success: true };
      throw error;
    }
    return { success: true };
  }

  async metaDataDeletionStatus(confirmationCode: string) {
    const receipt = await this.prisma.metaDataDeletionRequest.findUnique({
      where: { confirmationCode },
      select: { createdAt: true },
    });
    return receipt ? { status: 'completed' as const } : { status: 'not_found' as const };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredMetaDeletionReceipts() {
    const before = new Date(Date.now() - META_DELETION_RECEIPT_RETENTION_MS);
    const [deletionRequests, deauthorizations] = await Promise.all([
      this.prisma.metaDataDeletionRequest.deleteMany({ where: { createdAt: { lt: before } } }),
      this.prisma.metaDeauthorizationReceipt.deleteMany({ where: { createdAt: { lt: before } } }),
    ]);
    return { deletionRequests: deletionRequests.count, deauthorizations: deauthorizations.count };
  }

  private async drainAccountJobs(accountId: string, timeoutMessage: string, unavailableMessage: string) {
    try {
      const deadline = Date.now() + DRAIN_TIMEOUT_MS;
      while (true) {
        const pending = await this.jobsForAccount(DISCONNECT_JOB_STATES, accountId);
        if (pending.length) {
          await Promise.all(pending.map((job) => job.remove()));
          continue;
        }

        const active = await this.jobsForAccount(ACTIVE_JOB_STATES, accountId);
        if (!active.length) return;
        if (Date.now() >= deadline) throw new ServiceUnavailableException(timeoutMessage);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(unavailableMessage);
    }
  }

  private async jobsForAccount(
    states: readonly ('waiting' | 'delayed' | 'paused' | 'waiting-children' | 'prioritized' | 'active')[],
    accountId: string,
  ): Promise<Job<DmJob>[]> {
    const matching: Job<DmJob>[] = [];
    for (let start = 0; ; start += JOB_PAGE_SIZE) {
      const page = await this.dmQueue.getJobs([...states], start, start + JOB_PAGE_SIZE - 1);
      matching.push(...page.filter((job) => job.data?.igAccountId === accountId));
      if (page.length < JOB_PAGE_SIZE) break;
    }
    return matching;
  }
}
