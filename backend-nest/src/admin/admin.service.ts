import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ADMIN_PERMISSIONS } from '../common/admin-permissions';
import { AddAdmin, UpdateAdminPermissions, UpdateAdminRole } from './admin.dto';

const ADMIN_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listTeam() {
    return this.prisma.user.findMany({
      where: { role: { in: ADMIN_ROLES }, deletionRequestedAt: null },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, email: true, role: true, adminPermissions: true, isVerified: true, adminMfaEnabledAt: true, createdAt: true, suspendedAt: true },
    });
  }

  async addAdmin(actorId: string, input: AddAdmin) {
    const target = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Create and verify this user account before granting admin access.');
    return this.updateTeamRole(actorId, target.id, { role: 'ADMIN', reason: input.reason });
  }

  async updateTeamRole(actorId: string, targetId: string, input: UpdateAdminRole) {
    if (actorId === targetId) throw new ConflictException('You cannot change your own administrator role.');

    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, email: true, role: true, adminPermissions: true, isVerified: true, deletionRequestedAt: true, suspendedAt: true, createdAt: true },
      });
      if (!target || target.deletionRequestedAt) throw new NotFoundException('Active team member not found.');
      if (target.suspendedAt) throw new ConflictException('Reactivate the account before granting administrator access.');
      if (!target.isVerified) throw new ConflictException('Verify the account email before granting administrator access.');
      if (target.role === input.role) return { changed: false, member: this.toMember(target) };

      if (target.role === 'SUPER_ADMIN' && input.role !== 'SUPER_ADMIN') {
        const superAdminCount = await tx.user.count({ where: { role: 'SUPER_ADMIN', deletionRequestedAt: null, suspendedAt: null } });
        if (superAdminCount <= 1) throw new ConflictException('At least one active Super Admin must remain.');
      }

      const nextPermissions = input.role === 'ADMIN'
        ? (target.role === 'ADMIN' ? target.adminPermissions : DEFAULT_ADMIN_PERMISSIONS)
        : [];
      const changed = await tx.user.updateMany({
        where: { id: target.id, role: target.role, isVerified: true, deletionRequestedAt: null, suspendedAt: null },
        data: {
          role: input.role,
          adminPermissions: nextPermissions,
          sessionVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('This account changed while the request was being processed. Refresh and try again.');

      // Role changes always require the person to authenticate again, including
      // promotions. AdminGuard still checks the persisted role on each request.
      await tx.refreshToken.deleteMany({ where: { userId: target.id } });

      const requestId = randomUUID();
      await tx.adminAuditEvent.create({
        data: {
          actorId,
          action: 'ADMIN_ROLE_CHANGED',
          targetType: 'USER',
          targetId: target.id,
          reason: input.reason,
          requestId,
          before: { role: target.role } as Prisma.InputJsonValue,
          after: { role: input.role } as Prisma.InputJsonValue,
        },
      });

      return { changed: true, requestId, member: { ...this.toMember(target), role: input.role, adminPermissions: nextPermissions } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateAdminPermissions(actorId: string, targetId: string, input: UpdateAdminPermissions) {
    if (actorId === targetId) throw new ConflictException('You cannot change your own administrator permissions.');
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetId },
        select: { id: true, role: true, adminPermissions: true, isVerified: true, suspendedAt: true, deletionRequestedAt: true },
      });
      if (!target || target.role !== 'ADMIN' || target.deletionRequestedAt) {
        throw new NotFoundException('Active standard administrator not found.');
      }
      if (!target.isVerified || target.suspendedAt) throw new ConflictException('Only active, verified administrators can be configured.');
      const permissions = [...new Set(input.permissions)].sort();
      const changed = await tx.user.updateMany({
        where: { id: target.id, role: 'ADMIN', adminPermissions: { equals: target.adminPermissions }, isVerified: true, suspendedAt: null, deletionRequestedAt: null },
        data: { adminPermissions: permissions },
      });
      if (changed.count !== 1) throw new ConflictException('This administrator changed during the request. Refresh and retry.');
      const requestId = randomUUID();
      await tx.adminAuditEvent.create({ data: {
        actorId, action: 'ADMIN_PERMISSIONS_CHANGED', targetType: 'USER', targetId: target.id,
        reason: input.reason, requestId,
        before: { permissions: target.adminPermissions } as Prisma.InputJsonValue,
        after: { permissions } as Prisma.InputJsonValue,
      } });
      return { changed: true, requestId, permissions };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async resetAdminMfa(actorId: string, targetId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetId },
        select: { id: true, role: true, adminMfaEnabledAt: true, deletionRequestedAt: true, suspendedAt: true },
      });
      if (!target || !ADMIN_ROLES.includes(target.role) || target.deletionRequestedAt) {
        throw new NotFoundException('Active administrator not found.');
      }
      const changed = await tx.user.updateMany({
        where: { id: target.id, role: target.role, deletionRequestedAt: null, suspendedAt: null,
          adminMfaEnabledAt: target.adminMfaEnabledAt },
        data: {
          adminMfaEnabledAt: null, adminMfaSecretEnc: null, adminMfaPendingSecretEnc: null,
          adminMfaRecoveryCodeHashes: [], adminMfaChallengeHash: null, adminMfaChallengeExpiresAt: null,
          adminMfaLastUsedStep: null, sessionVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('This administrator changed during the request. Refresh and retry.');
      await tx.refreshToken.deleteMany({ where: { userId: target.id } });
      const requestId = randomUUID();
      await tx.adminAuditEvent.create({ data: {
        actorId, action: 'ADMIN_MFA_RESET', targetType: 'USER', targetId: target.id, reason, requestId,
        before: { mfaEnabled: Boolean(target.adminMfaEnabledAt) } as Prisma.InputJsonValue,
        after: { mfaEnabled: false, sessionsRevoked: true } as Prisma.InputJsonValue,
      } });
      return { changed: true, mfaSetupRequired: true, sessionsRevoked: true, requestId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async suspendAdmin(actorId: string, targetId: string, reason: string) {
    return this.changeAdminLifecycle(actorId, targetId, reason, 'SUSPEND');
  }

  async reactivateAdmin(actorId: string, targetId: string, reason: string) {
    return this.changeAdminLifecycle(actorId, targetId, reason, 'REACTIVATE');
  }

  private async changeAdminLifecycle(actorId: string, targetId: string, reason: string, action: 'SUSPEND' | 'REACTIVATE') {
    if (actorId === targetId) throw new ConflictException('You cannot suspend or reactivate your own administrator account.');
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetId },
        select: { id: true, role: true, suspendedAt: true, suspensionReason: true, deletionRequestedAt: true, sessionVersion: true },
      });
      if (!target || !ADMIN_ROLES.includes(target.role) || target.deletionRequestedAt) {
        throw new NotFoundException('Active administrator not found.');
      }
      if (action === 'SUSPEND' && target.suspendedAt) return { changed: false, status: 'SUSPENDED' };
      if (action === 'REACTIVATE' && !target.suspendedAt) return { changed: false, status: 'ACTIVE' };

      if (action === 'SUSPEND' && target.role === 'SUPER_ADMIN') {
        const activeSuperAdmins = await tx.user.count({
          where: { role: 'SUPER_ADMIN', suspendedAt: null, deletionRequestedAt: null },
        });
        if (activeSuperAdmins <= 1) throw new ConflictException('At least one active Super Admin must remain.');
      }

      const changedAt = new Date();
      const result = await tx.user.updateMany({
        where: {
          id: targetId, role: target.role, deletionRequestedAt: null,
          suspendedAt: action === 'SUSPEND' ? null : { not: null },
        },
        data: action === 'SUSPEND'
          ? {
            suspendedAt: changedAt, suspensionReason: reason, sessionVersion: { increment: 1 },
            adminMfaChallengeHash: null, adminMfaChallengeExpiresAt: null, adminMfaPendingSecretEnc: null,
          }
          : { suspendedAt: null, suspensionReason: null, sessionVersion: { increment: 1 } },
      });
      if (result.count !== 1) throw new ConflictException('This administrator changed while the request was being processed. Refresh and try again.');
      await tx.refreshToken.deleteMany({ where: { userId: targetId } });

      const requestId = randomUUID();
      await tx.adminAuditEvent.create({
        data: {
          actorId, action: action === 'SUSPEND' ? 'ADMIN_SUSPENDED' : 'ADMIN_REACTIVATED',
          targetType: 'USER', targetId, reason, requestId,
          before: { suspendedAt: target.suspendedAt, sessionVersion: target.sessionVersion } as Prisma.InputJsonValue,
          after: {
            suspendedAt: action === 'SUSPEND' ? changedAt.toISOString() : null,
            sessionVersion: target.sessionVersion + 1,
            sessionsRevoked: true,
          } as Prisma.InputJsonValue,
        },
      });
      return { changed: true, requestId, status: action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE', sessionsRevoked: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private toMember(member: {
    id: string; name: string; email: string; role: UserRole; isVerified: boolean; createdAt: Date; adminPermissions?: string[];
  }) {
    return { id: member.id, name: member.name, email: member.email, role: member.role, adminPermissions: member.adminPermissions ?? [], isVerified: member.isVerified, createdAt: member.createdAt };
  }
}
