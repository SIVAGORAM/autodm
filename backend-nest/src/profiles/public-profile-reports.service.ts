import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PublicProfileReportReason, PublicProfileReportStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePublicProfileReport, ReviewPublicProfileReport } from './public-profile-reports.dto';

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

@Injectable()
export class PublicProfileReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usernameInput: string, input: CreatePublicProfileReport) {
    const username = usernameInput.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) throw new NotFoundException('Profile not found.');

    const handle = await this.prisma.profileHandle.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, isCurrent: true },
      select: {
        username: true,
        profile: {
          select: {
            id: true, displayName: true, visibility: true,
            user: { select: { role: true, suspendedAt: true, deletionRequestedAt: true } },
          },
        },
      },
    });
    if (!handle || !handle.profile || handle.profile.visibility !== 'PUBLIC'
      || handle.profile.user.role !== 'INFLUENCER' || handle.profile.user.suspendedAt
      || handle.profile.user.deletionRequestedAt) {
      throw new NotFoundException('Profile not found.');
    }

    await this.prisma.publicProfileReport.create({
      data: {
        profileId: handle.profile.id,
        reportedUsername: handle.username,
        reportedDisplayName: handle.profile.displayName,
        reason: input.reason as PublicProfileReportReason,
        details: input.details,
      },
      select: { id: true },
    });
    // Keep the response generic; do not reveal whether an earlier report exists
    // or how moderation decisions are made.
    return { received: true };
  }

  async list(page: number, status?: PublicProfileReportStatus) {
    const where: Prisma.PublicProfileReportWhereInput = status ? { status } : {};
    const pageSize = 25;
    const [total, reports] = await this.prisma.$transaction([
      this.prisma.publicProfileReport.count({ where }),
      this.prisma.publicProfileReport.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, reportedUsername: true, reportedDisplayName: true,
          reason: true, details: true, status: true, moderationNote: true,
          reviewedAt: true, createdAt: true, updatedAt: true,
          profile: { select: { id: true, visibility: true, currentHandle: { select: { username: true } } } },
          reviewedBy: { select: { id: true, name: true } },
        },
      }),
    ]);
    return { page, pageSize, total, reports, hasMore: page * pageSize < total };
  }

  async review(reportId: string, adminId: string, input: ReviewPublicProfileReport) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const report = await tx.publicProfileReport.findUnique({
          where: { id: reportId },
          select: { id: true, profileId: true, status: true, reason: true, reportedUsername: true },
        });
        if (!report) throw new NotFoundException('Report not found.');
        if (report.status === 'ACTIONED' || report.status === 'DISMISSED') {
          if (report.status === input.status) return { id: report.id, status: report.status };
          throw new ConflictException('This report has already been closed.');
        }

        const before = {
          status: report.status,
          profileVisibility: report.profileId
            ? (await tx.publicProfile.findUnique({ where: { id: report.profileId }, select: { visibility: true } }))?.visibility ?? null
            : null,
        };
        if (input.status === 'ACTIONED' && report.profileId) {
          await tx.publicProfile.updateMany({
            where: { id: report.profileId },
            data: { visibility: 'PRIVATE', moderationBlockedAt: new Date() },
          });
        }
        const reviewedAt = input.status === 'IN_REVIEW' ? null : new Date();
        const updated = await tx.publicProfileReport.update({
          where: { id: report.id },
          data: {
            status: input.status,
            moderationNote: input.moderationNote,
            reviewedById: adminId,
            reviewedAt,
          },
          select: { id: true, status: true, moderationNote: true, reviewedAt: true },
        });
        await tx.adminAuditEvent.create({
          data: {
            actorId: adminId,
            action: 'PUBLIC_PROFILE_REPORT_REVIEWED',
            targetType: 'PublicProfileReport',
            targetId: report.id,
            reason: input.moderationNote,
            requestId: randomUUID(),
            before,
            after: {
              status: updated.status,
              profileVisibility: input.status === 'ACTIONED' && report.profileId ? 'PRIVATE' : before.profileVisibility,
              reason: report.reason,
            },
          },
        });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('This report changed during review. Refresh the queue and retry.');
      }
      throw error;
    }
  }

  async restore(reportId: string, adminId: string, reason: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const report = await tx.publicProfileReport.findUnique({
          where: { id: reportId },
          select: { id: true, profileId: true, status: true, reportedUsername: true },
        });
        if (!report || report.status !== 'ACTIONED' || !report.profileId) {
          throw new ConflictException('This report does not have a restorable profile.');
        }
        const profile = await tx.publicProfile.findUnique({
          where: { id: report.profileId },
          select: {
            visibility: true, moderationBlockedAt: true,
            user: { select: { role: true, suspendedAt: true, deletionRequestedAt: true } },
          },
        });
        if (!profile || !profile.moderationBlockedAt || profile.user.role !== 'INFLUENCER'
          || profile.user.suspendedAt || profile.user.deletionRequestedAt) {
          throw new ConflictException('The profile is no longer eligible for restoration.');
        }
        await tx.publicProfile.update({
          where: { id: report.profileId },
          data: { visibility: 'PUBLIC', moderationBlockedAt: null },
        });
        await tx.adminAuditEvent.create({
          data: {
            actorId: adminId,
            action: 'PUBLIC_PROFILE_RESTRICTION_RESTORED',
            targetType: 'PublicProfileReport',
            targetId: report.id,
            reason,
            requestId: randomUUID(),
            before: { profileVisibility: profile.visibility, moderationBlockedAt: profile.moderationBlockedAt },
            after: { profileVisibility: 'PUBLIC', moderationBlockedAt: null, reportedUsername: report.reportedUsername },
          },
        });
        return { id: report.id, profileVisibility: 'PUBLIC' as const };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('This profile changed during restoration. Refresh the queue and retry.');
      }
      throw error;
    }
  }
}
