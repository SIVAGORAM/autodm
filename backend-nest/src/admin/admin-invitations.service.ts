import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AdminPermission } from '../common/admin-permissions';
import { MailOutboxService } from '../mail/mail-outbox.service';
import { PrismaService } from '../prisma/prisma.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class AdminInvitationsService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: MailOutboxService) {}

  async list() {
    return this.prisma.adminInvitation.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, email: true, permissions: true, createdAt: true, expiresAt: true,
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async create(actorId: string, input: { email: string; permissions: AdminPermission[]; reason: string }) {
    const email = input.email.trim().toLowerCase();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const permissions = [...new Set(input.permissions)].sort();

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.adminInvitation.updateMany({
          where: { email, acceptedAt: null, revokedAt: null, expiresAt: { lte: now } },
          data: { revokedAt: now },
        });
        const current = await tx.adminInvitation.findFirst({
          where: { email, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          select: { id: true, expiresAt: true },
        });
        if (current) throw new ConflictException('An active invitation already exists for this email. Revoke it before sending another.');

        const target = await tx.user.findUnique({
          where: { email }, select: { id: true, role: true, suspendedAt: true, deletionRequestedAt: true },
        });
        if (target && (target.role !== 'INFLUENCER' || target.suspendedAt || target.deletionRequestedAt)) {
          throw new ConflictException('This account cannot accept a standard administrator invitation.');
        }

        const invitation = await tx.adminInvitation.create({
          data: { email, permissions, tokenHash, invitedById: actorId, expiresAt },
          select: { id: true, email: true, permissions: true, createdAt: true, expiresAt: true },
        });
        await this.outbox.queueAdminInvitation(tx, { invitationId: invitation.id, to: email, token, expiresAt });
        await tx.adminAuditEvent.create({ data: {
          actorId, action: 'ADMIN_INVITATION_CREATED', targetType: 'ADMIN_INVITATION', targetId: invitation.id,
          reason: input.reason, requestId: randomUUID(),
          after: { permissions, expiresAt: expiresAt.toISOString() } as Prisma.InputJsonValue,
        } });
        return { ...invitation, emailQueued: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An invitation for this email was created concurrently. Refresh the team list.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('The team changed while this invitation was being created. Please retry.');
      }
      throw error;
    }
  }

  async revoke(actorId: string, invitationId: string, reason: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invitation = await tx.adminInvitation.findUnique({
          where: { id: invitationId },
          select: { id: true, email: true, permissions: true, acceptedAt: true, revokedAt: true, expiresAt: true },
        });
        if (!invitation || invitation.acceptedAt || invitation.revokedAt) throw new NotFoundException('Pending invitation not found.');
        const now = new Date();
        const changed = await tx.adminInvitation.updateMany({
          where: { id: invitationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now },
        });
        if (changed.count !== 1) throw new ConflictException('This invitation changed while the request was being processed.');
        await tx.adminAuditEvent.create({ data: {
          actorId, action: 'ADMIN_INVITATION_REVOKED', targetType: 'ADMIN_INVITATION', targetId: invitationId,
          reason, requestId: randomUUID(), before: { status: 'PENDING', permissions: invitation.permissions } as Prisma.InputJsonValue,
          after: { status: 'REVOKED' } as Prisma.InputJsonValue,
        } });
        return { revoked: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('This invitation changed during revocation. Refresh the team list and retry.');
      }
      throw error;
    }
  }

  async accept(userId: string, token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invitation = await tx.adminInvitation.findUnique({ where: { tokenHash } });
        if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now) {
          throw new NotFoundException('This administrator invitation is invalid or expired.');
        }
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, role: true, isVerified: true, suspendedAt: true, deletionRequestedAt: true, sessionVersion: true },
        });
        if (!user || user.email.trim().toLowerCase() !== invitation.email) {
          throw new ConflictException('Sign in with a verified account using the invited email address.');
        }
        if (!user.isVerified || user.role !== 'INFLUENCER' || user.suspendedAt || user.deletionRequestedAt) {
          throw new ConflictException('This verified account cannot accept the administrator invitation.');
        }

        const userChanged = await tx.user.updateMany({
          where: {
            id: userId, email: invitation.email, role: 'INFLUENCER', isVerified: true,
            suspendedAt: null, deletionRequestedAt: null, sessionVersion: user.sessionVersion,
          },
          data: { role: 'ADMIN', adminPermissions: invitation.permissions, sessionVersion: { increment: 1 } },
        });
        if (userChanged.count !== 1) throw new ConflictException('This account changed while the invitation was being accepted.');

        const accepted = await tx.adminInvitation.updateMany({
          where: { id: invitation.id, tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { acceptedAt: now, acceptedById: userId },
        });
        if (accepted.count !== 1) throw new ConflictException('This invitation has already been used or expired.');
        await tx.refreshToken.deleteMany({ where: { userId } });
        await tx.adminAuditEvent.create({ data: {
          actorId: userId, action: 'ADMIN_INVITATION_ACCEPTED', targetType: 'ADMIN_INVITATION', targetId: invitation.id,
          reason: 'Invitee accepted the one-use invitation after verifying the matching account email.', requestId: randomUUID(),
          before: { role: 'INFLUENCER' } as Prisma.InputJsonValue,
          after: { role: 'ADMIN', permissions: invitation.permissions, sessionsRevoked: true } as Prisma.InputJsonValue,
        } });
        return { accepted: true, reauthenticationRequired: true, permissions: invitation.permissions };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('This invitation changed during acceptance. Sign in again and check your administrator status.');
      }
      throw error;
    }
  }
}
