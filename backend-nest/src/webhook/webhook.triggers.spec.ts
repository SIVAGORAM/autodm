import { WebhookService } from './webhook.service';

const account = { id: 'account-row-1', igUserId: 'ig-business-1', userId: 'owner-1', isActive: true };
const user = { plan: 'PRO', planExpiresAt: null, trialEndsAt: null, deletionRequestedAt: null };

function automation(id: string, triggerType: string, createdAt: Date, mediaId: string | null = null) {
  return {
    id,
    name: id,
    triggerType,
    mediaId,
    createdAt,
    matchMode: 'KEYWORDS',
    keywords: ['guide'],
    dailyLimit: 100,
    askToFollow: false,
    collectEmail: false,
    followUps: [],
    dmBlocks: [{ type: 'text', text: `Reply from ${id}` }],
  };
}

function setup(candidates: any[]) {
  const prisma: any = {
    igAccount: {
      findUnique: jest.fn().mockResolvedValue(account),
      findMany: jest.fn().mockResolvedValue([{ id: account.id }]),
    },
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    automation: { findMany: jest.fn().mockResolvedValue(candidates) },
    contact: {
      upsert: jest.fn().mockResolvedValue({ id: 'contact-1', igScopedId: 'viewer-1', username: 'viewer' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    run: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const queue: any = { getJob: jest.fn().mockResolvedValue(null), add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
  const quota: any = { consume: jest.fn().mockResolvedValue(true) };
  return { service: new WebhookService(prisma, queue, quota, { publish: jest.fn().mockResolvedValue(undefined) } as any), prisma, queue, quota };
}

describe('WebhookService automation selection', () => {
  it('prefers a matching media-specific comment rule over an any-post rule', async () => {
    const older = new Date('2026-01-01T00:00:00Z');
    const newer = new Date('2026-01-02T00:00:00Z');
    const fallback = automation('any-post', 'ANY_POST', older);
    const specific = automation('specific-post', 'POST_COMMENT', newer, 'media-1');
    const { service, queue } = setup([fallback, specific]);

    await (service as any).onComment(
      { id: account.igUserId },
      { id: 'comment-1', text: 'guide', from: { id: 'viewer-1', username: 'viewer' }, media: { id: 'media-1' } },
    );

    expect(queue.add).toHaveBeenCalledWith('send', expect.objectContaining({
      automationId: specific.id,
      triggerEventId: `comment:${account.igUserId}:comment-1`,
      text: 'Reply from specific-post',
    }), expect.objectContaining({ jobId: expect.stringMatching(/^dm-[a-f0-9]{64}$/) }));
  });

  it('queues a matching Reel comment event for its selected media rule', async () => {
    const specific = automation('reel-rule', 'POST_COMMENT', new Date('2026-01-02T00:00:00Z'), 'reel-1');
    const { service, queue } = setup([specific]);

    await (service as any).onComment(
      { id: account.igUserId },
      {
        id: 'reel-comment-1',
        text: 'guide',
        from: { id: 'viewer-1', username: 'viewer' },
        media: { id: 'reel-1', media_product_type: 'REELS' },
      },
    );

    expect(queue.add).toHaveBeenCalledWith('send', expect.objectContaining({
      automationId: specific.id,
      triggerEventId: `comment:${account.igUserId}:reel-comment-1`,
      text: 'Reply from reel-rule',
    }), expect.objectContaining({ jobId: expect.stringMatching(/^dm-[a-f0-9]{64}$/) }));
  });

  it('selects the oldest matching incoming DM rule deterministically', async () => {
    const older = automation('older-dm', 'DM', new Date('2026-01-01T00:00:00Z'));
    const newer = automation('newer-dm', 'DM', new Date('2026-01-02T00:00:00Z'));
    const { service, prisma, queue } = setup([newer, older]);

    await (service as any).onMessage(
      { id: account.igUserId },
      { sender: { id: 'viewer-1' }, timestamp: Date.now(), message: { mid: 'message-1', text: 'guide' } },
    );

    expect(prisma.automation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }));
    expect(queue.add).toHaveBeenCalledWith('send', expect.objectContaining({
      automationId: older.id,
      triggerEventId: `message:${account.igUserId}:message-1`,
      text: 'Reply from older-dm',
    }), expect.objectContaining({ jobId: expect.stringMatching(/^dm-[a-f0-9]{64}$/) }));
  });

  it('routes a documented message reply_to.story payload to Story reply automations', async () => {
    const storyRule = automation('story-rule', 'STORY_REPLY', new Date('2026-01-01T00:00:00Z'));
    const { service, prisma, queue } = setup([storyRule]);

    await (service as any).onMessage(
      { id: account.igUserId },
      {
        sender: { id: 'viewer-1' },
        timestamp: Date.now(),
        message: {
          mid: 'story-reply-1',
          text: 'guide please',
          reply_to: { story: { id: 'story-1', url: 'https://example.test/story' } },
        },
      },
    );

    expect(prisma.automation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { igAccountId: account.id, status: 'LIVE', triggerType: 'STORY_REPLY' },
    }));
    expect(queue.add).toHaveBeenCalledWith('send', expect.objectContaining({
      automationId: storyRule.id,
      triggerType: 'STORY_REPLY',
      triggerEventId: `message:${account.igUserId}:story-reply-1`,
      recipientIgsid: 'viewer-1',
      text: 'Reply from story-rule',
    }), expect.objectContaining({ jobId: expect.stringMatching(/^dm-[a-f0-9]{64}$/) }));
  });
});
