import { WeeklyDigestService } from './weekly-digest.service';

describe('WeeklyDigestService', () => {
  let service: WeeklyDigestService;
  let prisma: any;
  let mail: any;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      run: {
        count: jest.fn().mockResolvedValue(840),
      },
      contact: {
        count: jest.fn().mockResolvedValue(320),
      },
      click: {
        count: jest.fn().mockResolvedValue(512),
      },
      automation: {
        findFirst: jest.fn().mockResolvedValue({
          name: 'Photography Preset',
          _count: { runs: 840 },
        }),
      },
    };
    mail = {
      sendWeeklyCelebrationEmail: jest.fn().mockResolvedValue(true),
    };
    service = new WeeklyDigestService(prisma, mail);
  });

  it('gathers weekly creator stats and dispatches the celebration email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'creator@example.com',
      name: 'Siva',
      weeklyDigestEnabled: true,
    });

    const result = await service.sendDigestForUser('user-1');
    expect(result).toBe(true);

    expect(prisma.run.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'SENT' }),
    }));
    expect(prisma.contact.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ follows: true }),
    }));
    expect(prisma.click.count).toHaveBeenCalled();

    expect(mail.sendWeeklyCelebrationEmail).toHaveBeenCalledWith('creator@example.com', expect.objectContaining({
      creatorName: 'Siva',
      dmsSent: 840,
      newFollowers: 320,
      linkClicks: 512,
      topAutomationName: 'Photography Preset',
      topAutomationClickRate: 61,
    }));
  });

  it('skips sending if user has opted out of weekly digests', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'optout@example.com',
      name: 'Opt Out',
      weeklyDigestEnabled: false,
    });

    const result = await service.sendDigestForUser('user-2');
    expect(result).toBe(false);
    expect(mail.sendWeeklyCelebrationEmail).not.toHaveBeenCalled();
  });
});
