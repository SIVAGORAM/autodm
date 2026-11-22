import { ContactService } from './contact.service';

describe('ContactService', () => {
  const enquiry = { id: 'e1', status: 'NEW', subject: 'Agency question', createdAt: new Date() };
  const tx: any = { contactEnquiry: { create: jest.fn() } };
  const prisma: any = { $transaction: jest.fn((callback) => callback(tx)) };
  const outbox: any = { queueContactEnquiryNotification: jest.fn() };
  const service = new ContactService(prisma, outbox);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.contactEnquiry.create.mockResolvedValue(enquiry);
    outbox.queueContactEnquiryNotification.mockResolvedValue(undefined);
  });

  it('stores a valid public enquiry and queues an operations notification atomically', async () => {
    const result = await service.create({
      name: 'Creator Name', email: 'creator@example.test', subject: 'Agency question',
      message: 'Please tell me whether teams are available.', website: '',
    });
    expect(tx.contactEnquiry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'Creator Name', email: 'creator@example.test', subject: 'Agency question',
        messages: { create: { kind: 'SUBMISSION', body: 'Please tell me whether teams are available.' } },
      }), select: { id: true, subject: true, status: true, createdAt: true },
    }));
    expect(outbox.queueContactEnquiryNotification).toHaveBeenCalledWith(tx, enquiry.id, enquiry.subject);
    expect(result).toEqual({ accepted: true });
  });

  it('silently acknowledges honeypot submissions without saving visitor data', async () => {
    await expect(service.create({
      name: 'Bot', email: 'bot@example.test', subject: 'Promotion', message: 'Buy my product here.', website: 'https://spam.example',
    })).resolves.toEqual({ accepted: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.queueContactEnquiryNotification).not.toHaveBeenCalled();
  });
});
