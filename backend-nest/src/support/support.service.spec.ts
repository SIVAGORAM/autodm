import { NotFoundException } from '@nestjs/common';
import { SupportService } from './support.service';

describe('SupportService', () => {
  const prisma: any = {
    supportRequest: {
      create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), count: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
    },
    supportMessage: { create: jest.fn() },
    adminAuditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    $transaction: jest.fn((operations: any) => Array.isArray(operations) ? Promise.all(operations) : operations(prisma)),
  };
  const mailOutbox = { queueSupportReply: jest.fn(), queueSupportAdminNotification: jest.fn() } as any;
  const service = new SupportService(prisma, mailOutbox);

  beforeEach(() => jest.clearAllMocks());

  it('stores requests and the initial message under the authenticated user ID', async () => {
    prisma.supportRequest.create.mockResolvedValue({ id: 'request-1', status: 'OPEN', subject: 'Login help', messages: [{ id: 'message-1' }] });

    const result = await service.create('user-a', {
      type: 'SUPPORT', subject: 'Login help', message: 'I cannot verify my email.',
    });

    expect(prisma.supportRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        userId: 'user-a', type: 'SUPPORT', subject: 'Login help', rating: undefined,
        messages: { create: { authorId: 'user-a', senderType: 'CUSTOMER', body: 'I cannot verify my email.' } },
      },
    }));
    expect(mailOutbox.queueSupportAdminNotification).toHaveBeenCalledWith(expect.any(Object), 'user-a', 'Login help', 'message-1');
    expect(result.id).toBe('request-1');
  });

  it('limits customer history to the owner and a bounded recent page', async () => {
    prisma.supportRequest.findMany.mockResolvedValue([]);
    await service.listMine('user-a');
    expect(prisma.supportRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a' }, take: 50 }));
  });

  it('does not allow customers to reply to another user, feedback, or resolved requests', async () => {
    prisma.supportRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.replyAsCustomer('user-a', 'request-1', { body: 'More information.' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.supportRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'request-1', userId: 'user-a', type: 'SUPPORT', status: { not: 'RESOLVED' } }, data: { updatedAt: expect.any(Date) },
    });
    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
  });

  it('adds replies transactionally and updates the request timestamp', async () => {
    prisma.supportRequest.findFirst.mockResolvedValue({ subject: 'Login help' });
    prisma.supportRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.supportMessage.create.mockResolvedValue({ id: 'message-1', body: 'More information.' });

    const result = await service.replyAsCustomer('user-a', 'request-1', { body: 'More information.' });

    expect(result.id).toBe('message-1');
    expect(prisma.supportMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { requestId: 'request-1', authorId: 'user-a', senderType: 'CUSTOMER', body: 'More information.' },
    }));
    expect(prisma.supportRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'request-1' }) }));
    expect(mailOutbox.queueSupportAdminNotification).toHaveBeenCalledWith(expect.any(Object), 'user-a', 'Login help', 'message-1');
  });

  it('queues an encrypted notification in the same transaction when an admin replies', async () => {
    prisma.supportRequest.findUnique.mockResolvedValue({ subject: 'Login help', user: { id: 'user-a', email: 'user@example.com' } });
    prisma.supportRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.supportMessage.create.mockResolvedValue({ id: 'message-admin-1', body: 'We can help.' });

    await service.replyAsAdmin('request-1', 'admin-1', { body: 'We can help.' });

    expect(mailOutbox.queueSupportReply).toHaveBeenCalledWith(expect.any(Object), 'user-a', 'user@example.com', 'Login help', 'message-admin-1');
    expect(prisma.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: 'admin-1', action: 'SUPPORT_REPLY_RECORDED', targetId: 'request-1', after: { messageId: 'message-admin-1' },
    }) }));
  });

  it('paginates admin requests and applies the requested status filter', async () => {
    prisma.supportRequest.count.mockResolvedValue(51);
    prisma.supportRequest.findMany.mockResolvedValue([]);
    const result = await service.listForAdmin(2, 'OPEN');
    expect(prisma.supportRequest.count).toHaveBeenCalledWith({ where: { status: 'OPEN' } });
    expect(prisma.supportRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'OPEN' }, skip: 50, take: 50 }));
    expect(result).toMatchObject({ page: 2, pageSize: 50, total: 51, hasMore: false });
  });

  it('maps missing status-update targets to not found', async () => {
    prisma.supportRequest.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateStatus('missing', 'RESOLVED', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('audits support status updates in the same transaction without logging message content', async () => {
    prisma.supportRequest.findUnique.mockResolvedValue({ status: 'OPEN' });
    prisma.supportRequest.update.mockResolvedValue({ id: 'request-1', status: 'RESOLVED', updatedAt: new Date() });
    await service.updateStatus('request-1', 'RESOLVED', 'admin-1');
    expect(prisma.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: 'admin-1', action: 'SUPPORT_STATUS_CHANGED', before: { status: 'OPEN' }, after: { status: 'RESOLVED' },
    }) }));
  });
});
