import { AutomationsService } from './automations.service';

const automationId = 'e47ac8ea-402a-45ee-bbb1-1839aab0876d';
const followUpId = '6ad10504-e083-4a78-a903-d8f57ad59792';
const otherFollowUpId = '0a5b6231-d2c6-4df9-8e61-17f955959c36';
const textBlock = (text: string): { type: 'text'; text: string }[] => [{ type: 'text', text }];

function setup(existingIds: string[], triggerType = 'DM', conditions: string[] = []) {
  const instagram = { getMediaMetadata: jest.fn().mockResolvedValue({ id: 'media-a', media_type: 'IMAGE', ownerId: 'ig-user-a' }) };
  const encryption = { decrypt: jest.fn().mockReturnValue('provider-token') };
  const queue: any = { client: Promise.resolve({ get: jest.fn().mockResolvedValue(String(Date.now())) }) };
  const tx: any = {
    automation: { update: jest.fn().mockResolvedValue({ id: automationId, trackClicks: false }) },
    followUp: {
      findMany: jest.fn().mockResolvedValue(existingIds.map((id, index) => ({ id, condition: conditions[index] ?? 'DELAY' }))),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'new-follow-up-id' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma: any = {
    igAccount: {
      findUnique: jest.fn().mockResolvedValue({ id: 'account-a', userId: 'user-a', webhookSubscribedAt: new Date() }),
      findMany: jest.fn().mockResolvedValue([{ id: 'account-a' }]),
    },
    automation: {
      findUnique: jest.fn().mockResolvedValue({ id: automationId, igAccountId: 'account-a', triggerType, mediaId: triggerType === 'POST_COMMENT' ? 'media-a' : null, status: 'DRAFT', igAccount: { userId: 'user-a', igUserId: 'ig-user-a', webhookSubscribedAt: new Date(), accessTokenEnc: 'encrypted-token', loginMode: 'INSTAGRAM_LOGIN' } }),
      update: jest.fn().mockResolvedValue({ id: automationId, status: 'LIVE' }),
    },
    followUp: {
      findMany: jest.fn().mockResolvedValue(existingIds.map((id, index) => ({ id, condition: conditions[index] ?? 'DELAY' }))),
      count: jest.fn().mockResolvedValue(existingIds.length),
    },
    $transaction: jest.fn((callback: (client: any) => Promise<unknown>) => callback(tx)),
  };
  return { service: new AutomationsService(prisma, queue, {} as any, instagram as any, encryption as any), prisma, tx, instagram, queue };
}

describe('AutomationsService.update follow-up integrity', () => {
  it('does not activate Live Comment while the feature flag is disabled', async () => {
    const { service, prisma } = setup([], 'LIVE_COMMENT');

    await expect(service.setStatus('user-a', 'CREATOR', automationId, 'LIVE'))
      .rejects.toThrow('Live comment automations are not enabled for this Meta app yet');
    expect(prisma.automation.update).not.toHaveBeenCalled();
  });

  it('does not allow Live Comment to remain live during an edit while disabled', async () => {
    const { service, prisma, tx } = setup([], 'LIVE_COMMENT');
    prisma.automation.findUnique.mockResolvedValue({
      id: automationId, igAccountId: 'account-a', triggerType: 'LIVE_COMMENT', mediaId: null, status: 'LIVE',
      igAccount: { userId: 'user-a', webhookSubscribedAt: new Date() },
    });

    await expect(service.update('user-a', 'CREATOR', automationId, { name: 'Rename' }))
      .rejects.toThrow('Live comment automations are not enabled for this Meta app yet');
    expect(tx.automation.update).not.toHaveBeenCalled();
  });

  it('allows a Live Comment automation to be explicitly paused while disabled', async () => {
    const { service, prisma, tx } = setup([], 'LIVE_COMMENT');
    prisma.automation.findUnique.mockResolvedValue({
      id: automationId, igAccountId: 'account-a', triggerType: 'LIVE_COMMENT', mediaId: null, status: 'LIVE',
      igAccount: { userId: 'user-a', webhookSubscribedAt: null },
    });

    await service.update('user-a', 'CREATOR', automationId, { status: 'PAUSED' });
    expect(tx.automation.update).toHaveBeenCalledWith({ where: { id: automationId }, data: { status: 'PAUSED', replyToComment: false, publicReplies: [] } });
  });

  it('allows a supported automation to be paused when its webhook subscription is missing', async () => {
    const { service, prisma, tx } = setup([], 'POST_COMMENT');
    prisma.automation.findUnique.mockResolvedValue({
      id: automationId, igAccountId: 'account-a', triggerType: 'POST_COMMENT', mediaId: 'media-a', status: 'LIVE',
      igAccount: { userId: 'user-a', igUserId: 'ig-user-a', webhookSubscribedAt: null, accessTokenEnc: 'encrypted-token', loginMode: 'INSTAGRAM_LOGIN' },
    });

    await service.update('user-a', 'CREATOR', automationId, { status: 'PAUSED' });

    expect(tx.automation.update).toHaveBeenCalledWith({ where: { id: automationId }, data: { status: 'PAUSED' } });
  });

  it('clears comment-only reply settings when a post automation changes to Story Reply', async () => {
    const { service, tx } = setup([], 'POST_COMMENT');

    await service.update('user-a', 'CREATOR', automationId, {
      triggerType: 'STORY_REPLY', replyToComment: true, publicReplies: ['Thanks for commenting'],
    });

    expect(tx.automation.update).toHaveBeenCalledWith({ where: { id: automationId }, data: {
      triggerType: 'STORY_REPLY', replyToComment: false, publicReplies: [],
    } });
  });

  it('updates retained follow-up rows in place so queued jobs keep their IDs', async () => {
    const { service, tx } = setup([followUpId]);

    await service.update('user-a', 'CREATOR', automationId, {
      followUps: [{ id: followUpId, order: 0, condition: 'DELAY', delayMinutes: 90, dmBlocks: textBlock('Updated message') }],
    });

    expect(tx.automation.update).toHaveBeenCalledWith({ where: { id: automationId }, data: {
      replyToComment: false, publicReplies: [],
    } });
    expect(tx.followUp.update).toHaveBeenCalledWith({
      where: { id: followUpId },
      data: { order: 0, condition: 'DELAY', delayMinutes: 90, dmBlocks: textBlock('Updated message') },
    });
    expect(tx.followUp.create).not.toHaveBeenCalled();
    expect(tx.followUp.deleteMany).not.toHaveBeenCalled();
  });

  it('creates new steps and deletes only removed step IDs', async () => {
    const { service, tx } = setup([followUpId, otherFollowUpId]);

    await service.update('user-a', 'CREATOR', automationId, {
      followUps: [
        { id: followUpId, order: 0, condition: 'NO_REPLY', delayMinutes: 30, dmBlocks: textBlock('Keep this step') },
        { order: 1, condition: 'DELAY', delayMinutes: 60, dmBlocks: textBlock('Add this step') },
      ],
    });

    expect(tx.followUp.create).toHaveBeenCalledWith({
      data: { automationId, order: 1, condition: 'DELAY', delayMinutes: 60, dmBlocks: textBlock('Add this step') },
      select: { id: true },
    });
    expect(tx.followUp.deleteMany).toHaveBeenCalledWith({ where: { automationId, id: { in: [otherFollowUpId] } } });
  });

  it('rejects a follow-up ID that belongs to another automation', async () => {
    const { service, tx } = setup([followUpId]);

    await expect(service.update('user-a', 'CREATOR', automationId, {
      followUps: [{ id: otherFollowUpId, order: 0, condition: 'DELAY', delayMinutes: 60, dmBlocks: textBlock('No') }],
    })).rejects.toThrow('A follow-up step does not belong to this automation.');

    expect(tx.followUp.update).not.toHaveBeenCalled();
  });

  it('rejects adding an unsupported purchase condition through the update API', async () => {
    const { service, tx } = setup([]);

    await expect(service.update('user-a', 'CREATOR', automationId, {
      followUps: [{ order: 0, condition: 'BOUGHT', delayMinutes: 60, dmBlocks: textBlock('Thanks for buying') }],
    })).rejects.toThrow('Purchase and form-based follow-ups are unavailable');

    expect(tx.followUp.create).not.toHaveBeenCalled();
  });

  it('preserves an existing unsupported follow-up without allowing its condition to be newly selected', async () => {
    const { service, tx } = setup([followUpId], 'DM', ['BOUGHT']);

    await expect(service.update('user-a', 'CREATOR', automationId, {
      followUps: [{ id: followUpId, order: 0, condition: 'BOUGHT', delayMinutes: 90, dmBlocks: textBlock('Legacy step') }],
    })).resolves.toEqual(expect.objectContaining({ id: automationId }));

    expect(tx.followUp.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: followUpId } }));
  });

  it('rejects changing a supported follow-up into an unsupported purchase condition', async () => {
    const { service, tx } = setup([followUpId], 'DM', ['DELAY']);

    await expect(service.update('user-a', 'CREATOR', automationId, {
      followUps: [{ id: followUpId, order: 0, condition: 'BOUGHT', delayMinutes: 60, dmBlocks: textBlock('No') }],
    })).rejects.toThrow('Purchase and form-based follow-ups are unavailable');

    expect(tx.followUp.update).not.toHaveBeenCalled();
  });

  it('rejects an unsolicited no-reply follow-up for comment automations at the API service boundary', async () => {
    const { service, tx } = setup([], 'POST_COMMENT');

    await expect(service.update('user-a', 'CREATOR', automationId, {
      followUps: [{ order: 0, condition: 'NO_REPLY', delayMinutes: 30, dmBlocks: textBlock('Follow up') }],
    })).rejects.toThrow('The commenter must reply first');

    expect(tx.automation.update).not.toHaveBeenCalled();
  });

  it('rejects changing a legacy automation to comment-triggered when it has a no-reply follow-up', async () => {
    const { service, prisma, tx } = setup([followUpId], 'DM', ['NO_REPLY']);

    await expect(service.update('user-a', 'CREATOR', automationId, {
      triggerType: 'POST_COMMENT',
      mediaId: 'media-a',
    })).rejects.toThrow('The commenter must reply first');

    expect(prisma.followUp.findMany).toHaveBeenCalledWith({
      where: { automationId }, select: { id: true, condition: true },
    });
    expect(tx.automation.update).not.toHaveBeenCalled();
  });

  it('rejects changing a legacy automation to a specific-post trigger without a post ID', async () => {
    const { service, prisma, tx } = setup([], 'DM');
    prisma.automation.findUnique.mockResolvedValueOnce({
      id: automationId, igAccountId: 'account-a', triggerType: 'DM', mediaId: null,
      status: 'DRAFT', igAccount: { userId: 'user-a', webhookSubscribedAt: new Date() },
    });

    await expect(service.update('user-a', 'CREATOR', automationId, { triggerType: 'POST_COMMENT' }))
      .rejects.toThrow('Choose a specific post');
    expect(tx.automation.update).not.toHaveBeenCalled();
  });

  it('allows an owned video/Reel when updating a comment automation', async () => {
    const { service, tx, instagram } = setup([], 'POST_COMMENT');
    instagram.getMediaMetadata.mockResolvedValueOnce({ id: 'media-a', media_type: 'VIDEO', ownerId: 'ig-user-a' });

    await expect(service.update('user-a', 'CREATOR', automationId, { name: 'Updated name' }))
      .resolves.toEqual(expect.objectContaining({ id: automationId }));
    expect(tx.automation.update).toHaveBeenCalled();
    expect(instagram.getMediaMetadata).toHaveBeenCalledWith('provider-token', 'media-a', 'INSTAGRAM_LOGIN');
  });

  it('allows an owned video/Reel when activating an existing comment automation', async () => {
    const { service, prisma, instagram } = setup([], 'POST_COMMENT');
    instagram.getMediaMetadata.mockResolvedValueOnce({ id: 'media-a', media_type: 'VIDEO', ownerId: 'ig-user-a' });

    await expect(service.setStatus('user-a', 'CREATOR', automationId, 'LIVE'))
      .resolves.toEqual(expect.objectContaining({ id: automationId, status: 'LIVE' }));
    expect(prisma.automation.update).toHaveBeenCalledWith({ where: { id: automationId }, data: { status: 'LIVE' } });
    expect(instagram.getMediaMetadata).toHaveBeenCalledWith('provider-token', 'media-a', 'INSTAGRAM_LOGIN');
  });

  it('does not activate an automation when the DM delivery worker is offline', async () => {
    const { service, prisma, queue } = setup([]);
    queue.client = Promise.resolve({ get: jest.fn().mockResolvedValue(null) });

    await expect(service.setStatus('user-a', 'CREATOR', automationId, 'LIVE'))
      .rejects.toThrow('The DM delivery worker is offline');
    expect(prisma.automation.update).not.toHaveBeenCalled();
  });

  it('does not update an automation to LIVE when the DM delivery worker is offline', async () => {
    const { service, tx, queue } = setup([]);
    queue.client = Promise.resolve({ get: jest.fn().mockResolvedValue(null) });

    await expect(service.update('user-a', 'CREATOR', automationId, { status: 'LIVE' }))
      .rejects.toThrow('The DM delivery worker is offline');
    expect(tx.automation.update).not.toHaveBeenCalled();
  });

  it('rejects creating a comment automation with an unsolicited no-reply follow-up', async () => {
    const { service, prisma } = setup([]);

    await expect(service.create('user-a', 'CREATOR', {
      igAccountId: 'account-a', name: 'Comment reply', triggerType: 'POST_COMMENT', mediaId: 'media-a',
      matchMode: 'KEYWORDS', keywords: ['guide'], publicReplies: [], replyToComment: false,
      askToFollow: false, collectEmail: false, trackClicks: false,
      dmBlocks: textBlock('Here is the guide.'), status: 'DRAFT',
      followUps: [{ order: 0, condition: 'NO_REPLY', delayMinutes: 30, dmBlocks: textBlock('Checking in') }],
    })).rejects.toThrow('The commenter must reply first');

    expect(prisma.automation.findUnique).not.toHaveBeenCalled();
  });

  it('does not activate a legacy comment automation with a no-reply follow-up', async () => {
    const { service, prisma } = setup([followUpId], 'POST_COMMENT', ['NO_REPLY']);

    await expect(service.setStatus('user-a', 'CREATOR', automationId, 'LIVE'))
      .rejects.toThrow('The commenter must reply first');

    expect(prisma.automation.update).not.toHaveBeenCalled();
  });

  it('does not activate a legacy account-wide POST_COMMENT rule on the free plan', async () => {
    const { service, prisma } = setup([], 'POST_COMMENT');
    prisma.automation.findUnique.mockResolvedValueOnce({
      id: automationId, igAccountId: 'account-a', triggerType: 'POST_COMMENT', mediaId: null,
      status: 'DRAFT', matchMode: 'KEYWORDS', keywords: ['guide'], askToFollow: false,
      collectEmail: false, igAccount: { userId: 'user-a', webhookSubscribedAt: new Date() },
    });

    await expect(service.setStatus('user-a', 'FREE', automationId, 'LIVE'))
      .rejects.toThrow('This trigger needs a higher plan.');
    expect(prisma.automation.update).not.toHaveBeenCalled();
  });

  it.each(['POST_COMMENT', 'ANY_POST', 'STORY_REPLY', 'DM'])('does not activate a %s automation before Meta confirms its webhook subscription', async (triggerType) => {
    const { service, prisma } = setup([], triggerType);
    prisma.automation.findUnique.mockResolvedValueOnce({
      id: automationId, igAccountId: 'account-a', triggerType, mediaId: triggerType === 'POST_COMMENT' ? 'media-a' : null,
      matchMode: 'KEYWORDS', keywords: ['hello'], askToFollow: false, collectEmail: false,
      status: 'DRAFT', igAccount: {
        userId: 'user-a', igUserId: 'ig-user-a', webhookSubscribedAt: null,
        accessTokenEnc: 'encrypted-token', loginMode: 'INSTAGRAM_LOGIN',
      },
    });

    await expect(service.setStatus('user-a', 'CREATOR', automationId, 'LIVE'))
      .rejects.toThrow('webhook is not confirmed');

    expect(prisma.automation.update).not.toHaveBeenCalled();
  });
});
