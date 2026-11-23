import { AutomationsService } from './automations.service';

describe('AutomationsService list metrics', () => {
  it('reports only SENT message rows as the DM sent count', async () => {
    const automation = {
      id: 'automation-1', name: 'Welcome', status: 'LIVE', triggerType: 'POST_COMMENT',
      matchMode: 'KEYWORDS', keywords: [], askToFollow: false, collectEmail: false,
      igAccountId: 'account-1', dailyLimit: 100,
      igAccount: { id: 'account-1', tokenExpiresAt: null, isActive: true, webhookSubscribedAt: null },
      _count: { runs: 4, followUps: 0 },
    };
    const prisma: any = {
      automation: { findMany: jest.fn().mockResolvedValue([automation]) },
      user: { findUnique: jest.fn().mockResolvedValue({ plan: 'FREE', planExpiresAt: null, trialEndsAt: null }) },
      igAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'account-1' }]) },
      run: { groupBy: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ automationId: 'automation-1', _count: { automationId: 2 } }]) },
    };

    const [result] = await new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any).list('user-1');

    expect(result._count.runs).toBe(4);
    expect(result.sentCount).toBe(2);
    expect(result.health).toMatchObject({ level: 'at_risk', label: 'Webhooks needed' });
  });

  it('marks live automations at risk when the delivery worker heartbeat is missing', async () => {
    const automation = {
      id: 'automation-1', name: 'Welcome', status: 'LIVE', triggerType: 'POST_COMMENT',
      matchMode: 'KEYWORDS', keywords: [], askToFollow: false, collectEmail: false,
      igAccountId: 'account-1', dailyLimit: 100,
      igAccount: { id: 'account-1', tokenExpiresAt: null, isActive: true, webhookSubscribedAt: new Date() },
      _count: { runs: 0, followUps: 0 },
    };
    const prisma: any = {
      automation: { findMany: jest.fn().mockResolvedValue([automation]) },
      user: { findUnique: jest.fn().mockResolvedValue({ plan: 'CREATOR', planExpiresAt: null, trialEndsAt: null }) },
      igAccount: { findMany: jest.fn().mockResolvedValue([{ id: 'account-1' }]) },
      run: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const queue: any = { client: Promise.resolve({ get: jest.fn().mockResolvedValue(null) }) };

    const [result] = await new AutomationsService(prisma, queue, {} as any, {} as any, {} as any).list('user-1');

    expect(result.health).toMatchObject({ level: 'at_risk', label: 'Delivery offline' });
  });
});

describe('AutomationsService comment trigger selection', () => {
  it('requires a selected post for newly created POST_COMMENT automations', async () => {
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', webhookSubscribedAt: null }) },
      automation: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new AutomationsService(prisma, {} as any, {} as any, { getMediaMetadata: jest.fn() } as any, { decrypt: jest.fn() } as any);

    await expect(service.create('user-1', 'FREE', {
      igAccountId: 'account-1', name: 'Comment reply', triggerType: 'POST_COMMENT', mediaId: null,
      matchMode: 'KEYWORDS', keywords: ['guide'], publicReplies: [], replyToComment: false,
      askToFollow: false, collectEmail: false, trackClicks: false, dmBlocks: [{ type: 'text', text: 'Here is the guide.' }],
      status: 'DRAFT', followUps: [],
    })).rejects.toThrow('Choose a specific post');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('accepts an owned video/Reel for comment automation', async () => {
    const created = { id: 'automation-1', mediaId: 'media-1', triggerType: 'POST_COMMENT' };
    const transaction = { automation: { create: jest.fn().mockResolvedValue(created) } };
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({
        id: 'account-1', userId: 'user-1', igUserId: 'ig-user-1', webhookSubscribedAt: null,
        accessTokenEnc: 'encrypted-token', loginMode: 'INSTAGRAM_LOGIN',
      }) },
      automation: { create: jest.fn() },
      $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const instagram = { getMediaMetadata: jest.fn().mockResolvedValue({ id: 'media-1', media_type: 'VIDEO', ownerId: 'ig-user-1' }) };
    const encryption = { decrypt: jest.fn().mockReturnValue('provider-token') };
    const service = new AutomationsService(prisma, {} as any, {} as any, instagram as any, encryption as any);

    await expect(service.create('user-1', 'FREE', {
      igAccountId: 'account-1', name: 'Comment reply', triggerType: 'POST_COMMENT', mediaId: 'media-1',
      matchMode: 'KEYWORDS', keywords: ['guide'], publicReplies: [], replyToComment: false,
      askToFollow: false, collectEmail: false, trackClicks: false, dmBlocks: [{ type: 'text', text: 'Here is the guide.' }],
      status: 'DRAFT', followUps: [],
    })).resolves.toEqual(created);

    expect(encryption.decrypt).toHaveBeenCalledWith('encrypted-token');
    expect(instagram.getMediaMetadata).toHaveBeenCalledWith('provider-token', 'media-1', 'INSTAGRAM_LOGIN');
    expect(transaction.automation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ triggerType: 'POST_COMMENT', mediaId: 'media-1' }),
    }));
  });

  it('rejects a photo that is not owned by the connected Instagram account', async () => {
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({
        id: 'account-1', userId: 'user-1', igUserId: 'ig-user-1', webhookSubscribedAt: null,
        accessTokenEnc: 'encrypted-token', loginMode: 'INSTAGRAM_LOGIN',
      }) },
      automation: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const instagram = { getMediaMetadata: jest.fn().mockResolvedValue({ id: 'media-1', media_type: 'IMAGE', ownerId: 'other-ig-user' }) };
    const service = new AutomationsService(prisma, {} as any, {} as any, instagram as any, { decrypt: jest.fn().mockReturnValue('provider-token') } as any);

    await expect(service.create('user-1', 'FREE', {
      igAccountId: 'account-1', name: 'Comment reply', triggerType: 'POST_COMMENT', mediaId: 'media-1',
      matchMode: 'KEYWORDS', keywords: ['guide'], publicReplies: [], replyToComment: false,
      askToFollow: false, collectEmail: false, trackClicks: false, dmBlocks: [{ type: 'text', text: 'Here is the guide.' }],
      status: 'DRAFT', followUps: [],
    })).rejects.toThrow('published by the connected Instagram account');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('AutomationsService webhook subscription requirements', () => {
  it.each(['STORY_REPLY', 'DM'])('does not create a live %s automation without a confirmed message webhook', async (triggerType) => {
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({
        id: 'account-1', userId: 'user-1', webhookSubscribedAt: null,
      }) },
      automation: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(service.create('user-1', 'CREATOR', {
      igAccountId: 'account-1', name: 'Respond to messages', triggerType: triggerType as 'STORY_REPLY' | 'DM',
      matchMode: 'KEYWORDS', keywords: ['hello'], publicReplies: [], replyToComment: false,
      askToFollow: false, collectEmail: false, trackClicks: false,
      dmBlocks: [{ type: 'text', text: 'Thanks for reaching out.' }], status: 'LIVE', followUps: [],
    })).rejects.toThrow('Instagram comment and message webhooks are not confirmed');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('AutomationsService comment-only public replies', () => {
  it('clears comment-only reply settings from a Story Reply automation on create', async () => {
    const created = { id: 'automation-story' };
    const transaction = { automation: { create: jest.fn().mockResolvedValue(created) } };
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', webhookSubscribedAt: new Date() }) },
      $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const service = new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.create('user-1', 'CREATOR', {
      igAccountId: 'account-1', name: 'Story reply', triggerType: 'STORY_REPLY',
      matchMode: 'KEYWORDS', keywords: ['guide'], publicReplies: ['Thanks for commenting'], replyToComment: true,
      askToFollow: false, collectEmail: false, trackClicks: false,
      dmBlocks: [{ type: 'text', text: 'Here is the guide.' }], status: 'DRAFT', followUps: [],
    });

    expect(transaction.automation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ replyToComment: false, publicReplies: [] }),
    }));
  });
});

describe('AutomationsService worker availability requirements', () => {
  it('does not create a live automation when delivery processing is offline', async () => {
    const prisma: any = {
      igAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', webhookSubscribedAt: new Date() }),
        findMany: jest.fn().mockResolvedValue([{ id: 'account-1' }]),
      },
      automation: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const queue: any = { client: Promise.resolve({ get: jest.fn().mockResolvedValue(null) }) };
    const service = new AutomationsService(prisma, queue, {} as any, {} as any, {} as any);

    await expect(service.create('user-1', 'CREATOR', {
      igAccountId: 'account-1', name: 'Reply to comments', triggerType: 'DM',
      matchMode: 'KEYWORDS', keywords: ['hello'], publicReplies: [], replyToComment: false,
      askToFollow: false, collectEmail: false, trackClicks: false,
      dmBlocks: [{ type: 'text', text: 'Thanks for reaching out.' }], status: 'LIVE', followUps: [],
    })).rejects.toThrow('The DM delivery worker is offline');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('AutomationsService tracked follow-up links', () => {
  it('creates tracking rows for buttons in both the primary DM and follow-up messages', async () => {
    const transaction = {
      automation: { create: jest.fn().mockResolvedValue({ id: 'automation-1', trackClicks: true }) },
      trackedLink: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      followUp: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', webhookSubscribedAt: new Date() }) },
      $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const service = new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.create('user-1', 'CREATOR', {
      igAccountId: 'account-1', name: 'Welcome', triggerType: 'DM', matchMode: 'KEYWORDS', keywords: ['hello'],
      publicReplies: [], replyToComment: false, askToFollow: false, collectEmail: false, trackClicks: true,
      dmBlocks: [{ type: 'buttons', buttons: [{ title: 'Main link', url: 'https://creator.example/main' }] }],
      status: 'DRAFT',
      followUps: [{ order: 0, condition: 'DELAY', delayMinutes: 60,
        dmBlocks: [{ type: 'buttons', buttons: [{ title: 'Follow-up link', url: 'https://creator.example/follow-up' }] }] }],
    });

    expect(transaction.trackedLink.create).toHaveBeenCalledTimes(2);
    expect(transaction.trackedLink.create.mock.calls.map(([call]) => call.data.targetUrl).sort()).toEqual([
      'https://creator.example/follow-up', 'https://creator.example/main',
    ]);
  });
});
