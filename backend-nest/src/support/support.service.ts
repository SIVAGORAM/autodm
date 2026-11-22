import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailOutboxService } from '../mail/mail-outbox.service';
import { CreateSupportRequest, SupportMessageInput } from './support.dto';

const PAGE_SIZE = 50;
const messageSelection = {
  id: true,
  senderType: true,
  body: true,
  createdAt: true,
} as const;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService, private readonly mailOutbox: MailOutboxService) {}

  create(userId: string, input: CreateSupportRequest) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supportRequest.create({
        data: {
          userId,
          type: input.type,
          subject: input.subject,
          rating: input.rating,
          messages: { create: { authorId: userId, senderType: 'CUSTOMER', body: input.message } },
        },
        select: {
          id: true, type: true, status: true, subject: true, rating: true, createdAt: true, updatedAt: true,
          messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: messageSelection },
        },
      });
      const initialMessage = request.messages[0];
      if (initialMessage) await this.mailOutbox.queueSupportAdminNotification(tx, userId, request.subject, initialMessage.id);
      return request;
    });
  }

  listMine(userId: string) {
    return this.prisma.supportRequest.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE,
      select: {
        id: true, type: true, status: true, subject: true, rating: true, createdAt: true, updatedAt: true,
        messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: messageSelection },
      },
    });
  }

  async replyAsCustomer(userId: string, requestId: string, input: SupportMessageInput) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supportRequest.findFirst({
        where: { id: requestId, userId, type: 'SUPPORT', status: { not: 'RESOLVED' } },
        select: { subject: true },
      });
      const claimed = await tx.supportRequest.updateMany({
        where: { id: requestId, userId, type: 'SUPPORT', status: { not: 'RESOLVED' } },
        data: { updatedAt: new Date() },
      });
      if (claimed.count !== 1) throw new NotFoundException('Open support request not found.');
      const message = await tx.supportMessage.create({
        data: { requestId, authorId: userId, senderType: 'CUSTOMER', body: input.body },
        select: messageSelection,
      });
      if (request) await this.mailOutbox.queueSupportAdminNotification(tx, userId, request.subject, message.id);
      return message;
    });
  }

  async replyAsAdmin(requestId: string, adminId: string, input: SupportMessageInput) {
    return this.addMessage(requestId, adminId, 'ADMIN', input.body);
  }

  private async addMessage(requestId: string, authorId: string, senderType: 'CUSTOMER' | 'ADMIN', body: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = senderType === 'ADMIN'
        ? await tx.supportRequest.findUnique({
          where: { id: requestId }, select: { subject: true, user: { select: { id: true, email: true } } },
        })
        : null;
      if (senderType === 'ADMIN' && !request) throw new NotFoundException('Support request not found.');
      const updated = await tx.supportRequest.updateMany({ where: { id: requestId }, data: { updatedAt: new Date() } });
      if (updated.count !== 1) throw new NotFoundException('Support request not found.');
      const message = await tx.supportMessage.create({
        data: { requestId, authorId, senderType, body },
        select: messageSelection,
      });
      if (request) {
        await this.mailOutbox.queueSupportReply(tx, request.user.id, request.user.email, request.subject, message.id);
        await tx.adminAuditEvent.create({ data: {
          actorId: authorId, action: 'SUPPORT_REPLY_RECORDED', targetType: 'SUPPORT_REQUEST', targetId: requestId,
          reason: 'Administrator reply recorded; email notification queued for delivery.', requestId: randomUUID(),
          after: { messageId: message.id },
        } });
      }
      return message;
    });
  }

  async listForAdmin(page: number, status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') {
    const where = status ? { status } : {};
    const [total, requests] = await this.prisma.$transaction([
      this.prisma.supportRequest.count({ where }),
      this.prisma.supportRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { updatedAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, type: true, status: true, subject: true, rating: true,
          createdAt: true, updatedAt: true,
          messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: messageSelection },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);
    return { page, pageSize: PAGE_SIZE, total, requests, hasMore: page * PAGE_SIZE < total };
  }

  async updateStatus(id: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED', adminId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.supportRequest.findUnique({ where: { id }, select: { status: true } });
        if (!before) throw new NotFoundException('Support request not found.');
        const updated = await tx.supportRequest.update({
          where: { id }, data: { status }, select: { id: true, status: true, updatedAt: true },
        });
        await tx.adminAuditEvent.create({ data: {
          actorId: adminId, action: 'SUPPORT_STATUS_CHANGED', targetType: 'SUPPORT_REQUEST', targetId: id,
          reason: 'Administrator updated support request status.', requestId: randomUUID(),
          before: { status: before.status }, after: { status: updated.status },
        } });
        return updated;
      });
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2025') throw new NotFoundException('Support request not found.');
      throw error;
    }
  }
}
