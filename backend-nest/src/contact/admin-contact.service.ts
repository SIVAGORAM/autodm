import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactEnquiryPriority, ContactEnquiryStatus, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { MailOutboxService } from '../mail/mail-outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContactEnquiriesQuery } from './contact.dto';

const activeAdminRoles: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];

@Injectable()
export class AdminContactService {
  constructor(private readonly prisma: PrismaService, private readonly outbox: MailOutboxService) {}

  async list(actorId: string, query: ContactEnquiriesQuery) {
    const where: Prisma.ContactEnquiryWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.assigned === 'MINE') where.assignedAdminId = actorId;
    if (query.assigned === 'UNASSIGNED') where.assignedAdminId = null;
    if (query.search) where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { subject: { contains: query.search, mode: 'insensitive' } },
    ];

    const [total, enquiries] = await this.prisma.$transaction([
      this.prisma.contactEnquiry.count({ where }),
      this.prisma.contactEnquiry.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true, name: true, email: true, subject: true, status: true, priority: true,
          assignedAdminId: true, createdAt: true, updatedAt: true,
          assignedAdmin: { select: { id: true, name: true, email: true } },
          _count: { select: { messages: true } },
          messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1,
            select: { kind: true, body: true, createdAt: true, emailDeliveryStatus: true } },
        },
      }),
    ]);
    return { page: query.page, pageSize: query.pageSize, total, enquiries, hasMore: query.page * query.pageSize < total };
  }

  async detail(id: string) {
    const enquiry = await this.prisma.contactEnquiry.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, subject: true, status: true, priority: true,
        assignedAdminId: true, createdAt: true, updatedAt: true,
        assignedAdmin: { select: { id: true, name: true, email: true } },
        messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: {
          id: true, kind: true, body: true, createdAt: true, emailDeliveryStatus: true,
          authorAdmin: { select: { id: true, name: true } },
        } },
      },
    });
    if (!enquiry) throw new NotFoundException('Contact enquiry not found.');
    return enquiry;
  }

  async updateStatus(actorId: string, id: string, status: ContactEnquiryStatus, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.contactEnquiry.findUnique({ where: { id }, select: { status: true } });
      if (!before) throw new NotFoundException('Contact enquiry not found.');
      const updated = await tx.contactEnquiry.update({
        where: { id }, data: { status }, select: { id: true, status: true, updatedAt: true },
      });
      await tx.adminAuditEvent.create({ data: {
        actorId, action: 'CONTACT_ENQUIRY_STATUS_CHANGED', targetType: 'CONTACT_ENQUIRY', targetId: id,
        reason, requestId: randomUUID(), before: { status: before.status }, after: { status: updated.status },
      } });
      return updated;
    });
  }

  async updatePriority(actorId: string, id: string, priority: ContactEnquiryPriority, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.contactEnquiry.findUnique({ where: { id }, select: { priority: true } });
      if (!before) throw new NotFoundException('Contact enquiry not found.');
      const updated = await tx.contactEnquiry.update({
        where: { id }, data: { priority }, select: { id: true, priority: true, updatedAt: true },
      });
      await tx.adminAuditEvent.create({ data: {
        actorId, action: 'CONTACT_ENQUIRY_PRIORITY_CHANGED', targetType: 'CONTACT_ENQUIRY', targetId: id,
        reason, requestId: randomUUID(), before: { priority: before.priority }, after: { priority: updated.priority },
      } });
      return updated;
    });
  }

  async assign(actorId: string, id: string, assignedAdminId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const enquiry = await tx.contactEnquiry.findUnique({ where: { id }, select: { assignedAdminId: true } });
      if (!enquiry) throw new NotFoundException('Contact enquiry not found.');
      if (assignedAdminId) {
        const admin = await tx.user.findFirst({
          where: {
            id: assignedAdminId, role: { in: activeAdminRoles }, isVerified: true, suspendedAt: null,
            deletionRequestedAt: null, adminMfaEnabledAt: { not: null },
            OR: [{ role: 'SUPER_ADMIN' }, { role: 'ADMIN', adminPermissions: { has: 'CONTACT_MANAGE' } }],
          },
          select: { id: true },
        });
        if (!admin) throw new ConflictException('Assignment must target an active administrator with MFA enabled.');
      }
      const updated = await tx.contactEnquiry.update({
        where: { id }, data: { assignedAdminId }, select: { id: true, assignedAdminId: true, updatedAt: true },
      });
      await tx.adminAuditEvent.create({ data: {
        actorId, action: assignedAdminId ? 'CONTACT_ENQUIRY_ASSIGNED' : 'CONTACT_ENQUIRY_UNASSIGNED',
        targetType: 'CONTACT_ENQUIRY', targetId: id,
        reason: assignedAdminId ? 'Administrator assigned this enquiry.' : 'Administrator removed the enquiry assignment.',
        requestId: randomUUID(), before: { assignedAdminId: enquiry.assignedAdminId }, after: { assignedAdminId },
      } });
      return updated;
    });
  }

  async addMessage(actorId: string, id: string, body: string, kind: 'ADMIN_REPLY' | 'INTERNAL_NOTE') {
    return this.prisma.$transaction(async (tx) => {
      const enquiry = await tx.contactEnquiry.findUnique({
        where: { id }, select: { id: true, name: true, email: true, subject: true, status: true },
      });
      if (!enquiry) throw new NotFoundException('Contact enquiry not found.');
      if (enquiry.status === 'SPAM' || enquiry.status === 'CLOSED') {
        throw new ConflictException('Reopen this enquiry before adding a reply or note.');
      }
      const message = await tx.contactEnquiryMessage.create({
        data: {
          enquiryId: id, authorAdminId: actorId, kind, body,
          emailDeliveryStatus: kind === 'ADMIN_REPLY' ? 'QUEUED' : 'NOT_APPLICABLE',
        },
        select: { id: true, kind: true, body: true, createdAt: true, emailDeliveryStatus: true },
      });
      await tx.contactEnquiry.update({
        where: { id }, data: { updatedAt: new Date(), ...(kind === 'ADMIN_REPLY' ? { status: 'IN_PROGRESS' as const } : {}) },
      });
      if (kind === 'ADMIN_REPLY') await this.outbox.queueContactReply(tx, {
        enquiryId: id, messageId: message.id, to: enquiry.email, name: enquiry.name,
        subject: enquiry.subject, body,
      });
      await tx.adminAuditEvent.create({ data: {
        actorId, action: kind === 'ADMIN_REPLY' ? 'CONTACT_ENQUIRY_REPLY_QUEUED' : 'CONTACT_ENQUIRY_INTERNAL_NOTE_ADDED',
        targetType: 'CONTACT_ENQUIRY', targetId: id,
        reason: kind === 'ADMIN_REPLY' ? 'Administrator reply queued for email delivery.' : 'Administrator added an internal note.',
        requestId: randomUUID(), after: { messageId: message.id, emailDeliveryStatus: message.emailDeliveryStatus },
      } });
      return message;
    });
  }
}
