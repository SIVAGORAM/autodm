import { TrialService } from './trial.service';

describe('TrialService', () => {
  const candidate = {
    id: 'user-1', email: 'creator@example.test', name: 'Creator',
    trialEndsAt: new Date(Date.now() + 60 * 60 * 1000),
  };

  it('does not send a reminder when eligibility changed after the candidate query', async () => {
    const prisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([candidate]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const mail: any = { sendTrialEndingEmail: jest.fn() };
    const service = new TrialService(prisma, mail);

    await service.sendTrialReminders();

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'user-1', plan: 'FREE', deletionRequestedAt: null, trialReminderSent: false,
        trialEndsAt: { gt: expect.any(Date), lte: expect.any(Date) },
      }),
      data: { trialReminderSent: true },
    });
    expect(mail.sendTrialEndingEmail).not.toHaveBeenCalled();
  });

  it('releases the eligibility claim when mail delivery fails so a later tick can retry', async () => {
    const prisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([candidate]),
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    };
    const mail: any = { sendTrialEndingEmail: jest.fn().mockResolvedValue(false) };
    const service = new TrialService(prisma, mail);

    await service.sendTrialReminders();

    expect(prisma.user.updateMany).toHaveBeenNthCalledWith(2, {
      where: expect.objectContaining({
        id: 'user-1', plan: 'FREE', trialReminderSent: true,
        trialEndsAt: { gt: expect.any(Date), lte: expect.any(Date) },
      }),
      data: { trialReminderSent: false },
    });
  });
});
