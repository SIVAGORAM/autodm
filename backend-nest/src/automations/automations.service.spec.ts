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
  it('does not create a NEXT_POST automation that the webhook processor cannot run', async () => {
    const prisma: any = { igAccount: { findUnique: jest.fn() }, automation: { create: jest.fn() }, $transaction: jest.fn() };
    const service = new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(service.create('user-1', 'CREATOR', { triggerType: 'NEXT_POST' } as any))
      .rejects.toThrow('This automation trigger is not supported');
    expect(prisma.igAccount.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails closed when Live Comment is disabled for the Meta app', async () => {
    const prisma: any = { igAccount: { findUnique: jest.fn() }, automation: { create: jest.fn() }, $transaction: jest.fn() };
    const service = new AutomationsService(prisma, {} as any, {} as any, { liveCommentsEnabled: false } as any, {} as any);

    await expect(service.create('user-1', 'CREATOR', { triggerType: 'LIVE_COMMENT' } as any))
      .rejects.toThrow('Live comment automations are not enabled for this Meta app yet');
    expect(prisma.igAccount.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a Live Comment draft only when the feature is enabled and forbids follow-ups', async () => {
    const created = { id: 'live-automation', triggerType: 'LIVE_COMMENT' };
    const transaction = { automation: { create: jest.fn().mockResolvedValue(created) } };
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({
        id: 'account-1', userId: 'user-1', webhookFields: ['live_comments'],
      }) },
      $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const service = new AutomationsService(prisma, {} as any, {} as any, { liveCommentsEnabled: true } as any, {} as any);
    const input = {
      igAccountId: 'account-1', name: 'Live comment guide', triggerType: 'LIVE_COMMENT',
      matchMode: 'KEYWORDS', keywords: ['guide'], publicReplies: [], replyToComment: false,
      askToFollow: false, collectEmail: false, trackClicks: false,
      dmBlocks: [{ type: 'text', text: 'Here is the guide.' }], status: 'DRAFT', followUps: [],
    } as any;

    await expect(service.create('user-1', 'CREATOR', input)).resolves.toEqual(created);
    expect(transaction.automation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ triggerType: 'LIVE_COMMENT', replyToComment: false, publicReplies: [] }),
    }));
    await expect(service.create('user-1', 'CREATOR', {
      ...input, followUps: [{ condition: 'DELAY', delayMinutes: 60 }],
    })).rejects.toThrow('Live comment automations cannot use follow-ups');
  });

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
  it.each(['STORY_REPLY', 'STORY_MENTION', 'DM'])('does not create a live %s automation without a confirmed message webhook', async (triggerType) => {
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
    })).rejects.toThrow('webhook is not confirmed');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('AutomationsService comment-only public replies', () => {
  it('clears comment-only reply settings from a Story Reply automation on create', async () => {
    const created = { id: 'automation-story' };
    const transaction = { automation: { create: jest.fn().mockResolvedValue(created) } };
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', igUserId: 'ig-user-1', webhookSubscribedAt: new Date() }) },
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
      igAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', igUserId: 'ig-user-1', webhookSubscribedAt: new Date() }) },
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

  it('persists autoLikeComment for comment triggers and enforces false for message triggers', async () => {
    const transaction = {
      automation: { create: jest.fn().mockResolvedValue({ id: 'automation-1', trackClicks: false }) },
    };
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', igUserId: 'ig-user-1', webhookSubscribedAt: new Date() }) },
      $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const instagram: any = {
      getMediaMetadata: jest.fn().mockResolvedValue({ id: 'media-1', media_type: 'IMAGE', ownerId: 'ig-user-1' }),
    };
    const encryption: any = { decrypt: jest.fn().mockReturnValue('token') };
    const service = new AutomationsService(prisma, {} as any, {} as any, instagram, encryption);

    // 1. Post comment trigger with autoLikeComment: true
    await service.create('user-1', 'CREATOR', {
      igAccountId: 'account-1', name: 'Post Comment with Like', triggerType: 'POST_COMMENT', mediaId: 'media-1',
      matchMode: 'KEYWORDS', keywords: ['hello'], publicReplies: [], replyToComment: true, autoLikeComment: true,
      askToFollow: false, collectEmail: false, trackClicks: false,
      dmBlocks: [{ type: 'text', text: 'Hello' }], status: 'DRAFT', followUps: [],
    });

    expect(transaction.automation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ autoLikeComment: true }),
    }));

    // 2. DM trigger ignores autoLikeComment (sets false)
    await service.create('user-1', 'CREATOR', {
      igAccountId: 'account-1', name: 'DM Trigger', triggerType: 'DM',
      matchMode: 'KEYWORDS', keywords: ['hello'], publicReplies: [], replyToComment: false, autoLikeComment: true,
      askToFollow: false, collectEmail: false, trackClicks: false,
      dmBlocks: [{ type: 'text', text: 'Hello' }], status: 'DRAFT', followUps: [],
    });

    expect(transaction.automation.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ autoLikeComment: false }),
    }));

    // 3. STORY_MENTION trigger ignores autoLikeComment (sets false) and requires messages webhook
    await service.create('user-1', 'CREATOR', {
      igAccountId: 'account-1', name: 'Story Mention Trigger', triggerType: 'STORY_MENTION',
      matchMode: 'ANY', keywords: [], publicReplies: [], replyToComment: false, autoLikeComment: true,
      askToFollow: false, collectEmail: false, trackClicks: false,
      dmBlocks: [{ type: 'text', text: 'Thank you for the story mention!' }], status: 'DRAFT', followUps: [],
    });

    expect(transaction.automation.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        triggerType: 'STORY_MENTION',
        autoLikeComment: false,
        replyToComment: false,
      }),
    }));
  });

  it('rejects STORY_MENTION trigger creation for FREE tier users', async () => {
    const transaction = {
      automation: { create: jest.fn() },
    };
    const prisma: any = {
      igAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'account-1', userId: 'user-1', igUserId: 'ig-user-1', webhookSubscribedAt: new Date() }) },
      $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    };
    const service = new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(service.create('user-1', 'FREE', {
      igAccountId: 'account-1', name: 'Story Mention Trigger', triggerType: 'STORY_MENTION',
      matchMode: 'ANY', keywords: [], publicReplies: [], replyToComment: false, autoLikeComment: false,
      askToFollow: false, collectEmail: false, trackClicks: false,
      dmBlocks: [{ type: 'text', text: 'Thanks!' }], status: 'DRAFT', followUps: [],
    })).rejects.toThrow('This trigger needs a higher plan.');
  });

  describe('AutomationsService giveaway picker', () => {
    it('returns giveaway entries and winner stats', async () => {
      const prisma: any = {
        automation: { findUnique: jest.fn().mockResolvedValue({ id: 'auto-1', igAccount: { userId: 'user-1' } }) },
        giveawayEntry: {
          count: jest.fn().mockResolvedValue(42),
          findFirst: jest.fn().mockResolvedValue({
            id: 'entry-winner',
            ticketNumber: 1015,
            igUsername: 'lucky_fan',
            wonAt: new Date('2026-11-20T12:00:00Z'),
            contact: { username: 'lucky_fan', name: 'Lucky Fan' },
          }),
          findMany: jest.fn().mockResolvedValue([
            { id: 'entry-1', ticketNumber: 1001, igUsername: 'fan1', status: 'ENTERED', createdAt: new Date() },
          ]),
        },
      };
      const service = new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any);

      const result = await service.getGiveaway('user-1', 'auto-1');
      expect(result.totalEntries).toBe(42);
      expect(result.winner?.ticketNumber).toBe(1015);
      expect(result.winner?.username).toBe('lucky_fan');
    });

    it('picks a random winner from eligible entries and marks wonAt', async () => {
      const eligibleEntries = [
        { id: 'entry-1', ticketNumber: 1001, igUsername: 'fan1', status: 'ENTERED', contact: { username: 'fan1', name: 'Fan One' } },
        { id: 'entry-2', ticketNumber: 1002, igUsername: 'fan2', status: 'ENTERED', contact: { username: 'fan2', name: 'Fan Two' } },
      ];
      const prisma: any = {
        automation: { findUnique: jest.fn().mockResolvedValue({ id: 'auto-1', igAccount: { userId: 'user-1' } }) },
        giveawayEntry: {
          findMany: jest.fn().mockResolvedValue(eligibleEntries),
          update: jest.fn().mockResolvedValue({ id: 'entry-1', status: 'WON' }),
        },
      };
      const service = new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any);

      const winner = await service.pickGiveawayWinner('user-1', 'auto-1');
      expect(winner).toHaveProperty('ticketNumber');
      expect(['fan1', 'fan2']).toContain(winner.username);
      expect(prisma.giveawayEntry.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'WON' }),
      }));
    });

    it('throws when no eligible entries exist to pick', async () => {
      const prisma: any = {
        automation: { findUnique: jest.fn().mockResolvedValue({ id: 'auto-1', igAccount: { userId: 'user-1' } }) },
        giveawayEntry: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const service = new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any);

      await expect(service.pickGiveawayWinner('user-1', 'auto-1')).rejects.toThrow('No eligible entries found in this giveaway');
    });

    it('resets winners back to ENTERED status', async () => {
      const prisma: any = {
        automation: { findUnique: jest.fn().mockResolvedValue({ id: 'auto-1', igAccount: { userId: 'user-1' } }) },
        giveawayEntry: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const service = new AutomationsService(prisma, {} as any, {} as any, {} as any, {} as any);

      const res = await service.resetGiveawayWinner('user-1', 'auto-1');
      expect(res.success).toBe(true);
      expect(prisma.giveawayEntry.updateMany).toHaveBeenCalledWith({
        where: { automationId: 'auto-1', status: 'WON' },
        data: { status: 'ENTERED', wonAt: null },
      });
    });
  });
});
