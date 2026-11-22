import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminContactService } from './admin-contact.service';

describe('AdminContactService', () => {
  const enquiry = { id: 'enq-1', name: 'Creator', email: 'creator@example.test', subject: 'Partnership', status: 'NEW' };
  const tx: any = {
    contactEnquiry: { findUnique: jest.fn(), update: jest.fn() },
    contactEnquiryMessage: { create: jest.fn() },
    user: { findFirst: jest.fn() },
    adminAuditEvent: { create: jest.fn() },
  };
  const prisma: any = {
    contactEnquiry: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((input) => Array.isArray(input) ? Promise.all(input) : input(tx)),
  };
  const outbox: any = { queueContactReply: jest.fn() };
  const service = new AdminContactService(prisma, outbox);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.contactEnquiry.findUnique.mockResolvedValue({ ...enquiry });
    tx.contactEnquiry.update.mockResolvedValue({ id: 'enq-1', status: 'IN_PROGRESS', updatedAt: new Date() });
    tx.contactEnquiryMessage.create.mockResolvedValue({ id: 'msg-1', kind: 'ADMIN_REPLY', body: 'Thanks.', emailDeliveryStatus: 'QUEUED' });
    tx.user.findFirst.mockResolvedValue({ id: 'admin-1' });
  });

  it('creates an email reply, queues delivery, and audits metadata without storing message text in the audit', async () => {
    await service.addMessage('admin-1', 'enq-1', 'Thanks for reaching out.', 'ADMIN_REPLY');
    expect(tx.contactEnquiryMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: 'ADMIN_REPLY', emailDeliveryStatus: 'QUEUED', authorAdminId: 'admin-1' }),
    }));
    expect(outbox.queueContactReply).toHaveBeenCalledWith(tx, expect.objectContaining({
      enquiryId: 'enq-1', messageId: 'msg-1', to: 'creator@example.test', body: 'Thanks for reaching out.',
    }));
    const audit = tx.adminAuditEvent.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: 'CONTACT_ENQUIRY_REPLY_QUEUED', targetId: 'enq-1' });
    expect(JSON.stringify(audit)).not.toContain('Thanks for reaching out.');
  });

  it('stores internal notes without queuing email', async () => {
    tx.contactEnquiryMessage.create.mockResolvedValueOnce({ id: 'note-1', kind: 'INTERNAL_NOTE', body: 'Check with sales.', emailDeliveryStatus: 'NOT_APPLICABLE' });
    await service.addMessage('admin-1', 'enq-1', 'Check with sales.', 'INTERNAL_NOTE');
    expect(outbox.queueContactReply).not.toHaveBeenCalled();
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'CONTACT_ENQUIRY_INTERNAL_NOTE_ADDED',
    }) }));
  });

  it('does not send a reply to a closed or spam enquiry', async () => {
    tx.contactEnquiry.findUnique.mockResolvedValueOnce({ ...enquiry, status: 'CLOSED' });
    await expect(service.addMessage('admin-1', 'enq-1', 'A reply', 'ADMIN_REPLY')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.contactEnquiryMessage.create).not.toHaveBeenCalled();
    expect(outbox.queueContactReply).not.toHaveBeenCalled();
  });

  it('only assigns enquiries to active verified admins with enrolled MFA', async () => {
    await service.assign('admin-1', 'enq-1', 'admin-2');
    expect(tx.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isVerified: true, suspendedAt: null, deletionRequestedAt: null, adminMfaEnabledAt: { not: null } }),
    }));
  });

  it('rejects assignment to an inactive administrator', async () => {
    tx.user.findFirst.mockResolvedValueOnce(null);
    await expect(service.assign('admin-1', 'enq-1', 'admin-2')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.contactEnquiry.update).not.toHaveBeenCalled();
  });

  it('writes before and after state for status changes in the same transaction', async () => {
    tx.contactEnquiry.findUnique.mockResolvedValueOnce({ status: 'NEW' });
    tx.contactEnquiry.update.mockResolvedValueOnce({ id: 'enq-1', status: 'IN_PROGRESS', updatedAt: new Date() });
    await service.updateStatus('admin-1', 'enq-1', 'IN_PROGRESS', 'Sales requested a follow-up');
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'CONTACT_ENQUIRY_STATUS_CHANGED', reason: 'Sales requested a follow-up', before: { status: 'NEW' }, after: { status: 'IN_PROGRESS' },
    }) }));
  });

  it('returns not found instead of exposing a missing enquiry', async () => {
    prisma.contactEnquiry.findUnique.mockResolvedValueOnce(null);
    await expect(service.detail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
