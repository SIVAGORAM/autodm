import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService data export', () => {
  const account = {
    id: 'user-a', email: 'creator@example.test', name: 'Creator', profilePicUrl: null, role: 'INFLUENCER',
    isVerified: true, plan: 'FREE', planExpiresAt: null, trialEndsAt: null, dmCount: 0,
    termsVersion: 'terms-v1', termsAcceptedAt: new Date('2026-01-01T00:00:00Z'),
    privacyVersion: 'privacy-v1', privacyAcknowledgedAt: new Date('2026-01-01T00:00:00Z'),
    ageConfirmedAt: new Date('2026-01-01T00:00:00Z'),
    dmCountResetAt: null, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  const tx = {
    user: { findUnique: jest.fn() },
    igAccount: { findMany: jest.fn().mockResolvedValue([]) },
    automation: { findMany: jest.fn().mockResolvedValue([]) },
    contact: { findMany: jest.fn().mockResolvedValue([]) },
    run: { findMany: jest.fn().mockResolvedValue([]) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    click: { findMany: jest.fn().mockResolvedValue([]) },
    supportRequest: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    contact: { count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
    igAccount: { findMany: jest.fn() },
    $transaction: jest.fn((input: any) => Array.isArray(input) ? Promise.all(input) : input(tx)),
  };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.user.findUnique.mockResolvedValue(account);
    prisma.contact.count.mockResolvedValue(0);
    prisma.contact.findMany.mockResolvedValue([]);
    prisma.igAccount.findMany.mockResolvedValue([]);
    service = new UsersService(prisma as any);
  });

  it('exports only the authenticated user’s scoped product data and excludes secrets/raw webhooks', async () => {
    const output = await service.exportData('user-a');

    expect(output.account).toEqual(account);
    expect(output).toMatchObject({
      schemaVersion: 1,
      instagramAccounts: [],
      automations: [],
      contacts: [],
      deliveryRuns: [],
      payments: [],
      clickEvents: [],
      supportRequests: [],
      excluded: expect.arrayContaining(['Passwords and authentication tokens', 'Raw Meta webhook payloads']),
    });
    expect(tx.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-a' } }));
    expect(tx.igAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a' } }));
    expect(tx.automation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { igAccount: { userId: 'user-a' } } }));
    expect(tx.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { igAccount: { userId: 'user-a' } } }));
    expect(tx.run.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { igAccount: { userId: 'user-a' } } }));
    expect(tx.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a' } }));
    expect(tx.click.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { trackedLink: { automation: { igAccount: { userId: 'user-a' } } } } }));
    expect(tx.supportRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-a' } }));

    const accountSelection = tx.user.findUnique.mock.calls[0][0].select;
    const igAccountSelection = tx.igAccount.findMany.mock.calls[0][0].select;
    expect(accountSelection).toEqual(expect.objectContaining({
      termsVersion: true,
      termsAcceptedAt: true,
      privacyVersion: true,
      privacyAcknowledgedAt: true,
      ageConfirmedAt: true,
    }));
    expect(accountSelection).not.toHaveProperty('passwordHash');
    expect(accountSelection).not.toHaveProperty('otpCode');
    expect(igAccountSelection).not.toHaveProperty('accessTokenEnc');
  });

  it('does not export a missing account', async () => {
    tx.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.exportData('missing-user')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.igAccount.findMany).not.toHaveBeenCalled();
  });

  it('lists contacts only through accounts owned by the caller and omits platform IDs', async () => {
    prisma.contact.count.mockResolvedValueOnce(1);
    prisma.contact.findMany.mockResolvedValueOnce([{ id: 'contact-1', username: 'creator_fan', follows: false, dmsSent: 2 }]);
    prisma.igAccount.findMany.mockResolvedValueOnce([{ id: 'account-1', username: 'my_creator_account' }]);

    const result = await service.listContacts('user-a', { page: 2, pageSize: 25, accountId: 'account-1', search: 'fan' });

    expect(prisma.contact.count).toHaveBeenCalledWith({
      where: { igAccount: { userId: 'user-a', isActive: true, id: 'account-1' }, username: { contains: 'fan', mode: 'insensitive' } },
    });
    expect(prisma.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { igAccount: { userId: 'user-a', isActive: true, id: 'account-1' }, username: { contains: 'fan', mode: 'insensitive' } },
      skip: 25,
      take: 25,
    }));
    expect(prisma.igAccount.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', isActive: true },
      orderBy: { username: 'asc' },
      select: { id: true, username: true },
    });
    const selection = prisma.contact.findMany.mock.calls[0][0].select;
    expect(selection).not.toHaveProperty('igScopedId');
    expect(selection).not.toHaveProperty('email');
    expect(result.pagination).toEqual({ page: 2, pageSize: 25, total: 1, totalPages: 1 });
  });

  it('updates notes and normalized tags only for contacts owned by the caller', async () => {
    prisma.contact.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.contact.findFirst.mockResolvedValueOnce({ id: 'contact-1', notes: 'Potential customer', tags: ['lead', 'follow-up'] });

    const result = await service.updateContact('user-a', 'contact-1', {
      notes: '  Potential customer  ', tags: ['lead', 'follow-up', 'lead', '  '],
    });

    expect(prisma.contact.updateMany).toHaveBeenCalledWith({
      where: { id: 'contact-1', igAccount: { userId: 'user-a' } },
      data: { notes: 'Potential customer', tags: ['lead', 'follow-up'] },
    });
    expect(result).toEqual({ id: 'contact-1', notes: 'Potential customer', tags: ['lead', 'follow-up'] });
  });

  it('does not reveal or update a contact owned by another user', async () => {
    prisma.contact.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.updateContact('user-a', 'contact-other', { notes: '', tags: [] }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.contact.findFirst).not.toHaveBeenCalled();
  });

  it('streams a CSV without platform identifiers and neutralizes spreadsheet formulas', async () => {
    prisma.contact.findMany
      .mockResolvedValueOnce([{
        id: 'contact-1', username: '=IMPORTDATA("https://example.test")', notes: '', tags: [], follows: true, dmsSent: 3,
        firstInteraction: new Date('2026-01-01T00:00:00.000Z'), lastInteraction: new Date('2026-01-02T00:00:00.000Z'),
        igAccount: { username: 'creator' },
      }])
      .mockResolvedValueOnce([]);

    const chunks: string[] = [];
    for await (const chunk of service.streamContactsCsv('user-a', { search: 'fan' })) chunks.push(chunk);

    expect(chunks.join('')).toContain("'@=IMPORTDATA");
    expect(chunks.join('')).toContain('creator');
    expect(chunks.join('')).not.toContain('igScopedId');
    expect(prisma.contact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { igAccount: { userId: 'user-a', isActive: true }, username: { contains: 'fan', mode: 'insensitive' } },
      take: 500,
    }));
    expect(prisma.contact.findMany.mock.calls[0][0].select).not.toHaveProperty('igScopedId');
  });
});
