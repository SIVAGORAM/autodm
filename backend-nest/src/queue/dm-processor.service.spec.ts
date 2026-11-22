import { DmProcessorService } from './dm-processor.service';

describe('DmProcessorService delivery recovery', () => {
  it('does not repeat a successful public comment reply when the DM needs a retry', async () => {
    let run: any = null;
    const automation = {
      id: 'automation-1', status: 'LIVE', triggerType: 'POST_COMMENT', matchMode: 'KEYWORDS', keywords: ['hello'],
      askToFollow: false, collectEmail: false, dailyLimit: 100, replyToComment: true,
      publicReplies: ['Thanks for your comment!'], dmBlocks: [{ type: 'text', text: 'Here is the guide.' }],
      trackClicks: false, trackedLinks: [], followUps: [],
      igAccount: { id: 'account-1', isActive: true, igUserId: 'ig-user-1', accessTokenEnc: 'encrypted', user: { id: 'user-1', plan: 'PRO' } },
    };
    const prisma: any = {
      run: {
        findUnique: jest.fn(async () => run ? { ...run } : null),
        upsert: jest.fn(async ({ create, update }) => { run = { ...run, ...create, ...update }; return run; }),
        update: jest.fn(async ({ data }) => { run = { ...run, ...data }; return run; }),
      },
      automation: { findUnique: jest.fn().mockResolvedValue(automation) },
      igAccount: {
        findMany: jest.fn().mockResolvedValue([{ id: 'account-1' }]),
        findUnique: jest.fn().mockResolvedValue({ isActive: true, user: { deletionRequestedAt: null } }),
      },
      contact: {
        upsert: jest.fn().mockResolvedValue({ id: 'contact-1', name: 'Fan' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const meta: any = {
      replyToComment: jest.fn().mockResolvedValue({ ok: true, data: {} }),
      sendCommentDm: jest.fn()
        .mockResolvedValueOnce({ ok: false, error: 'temporary provider error', retryable: true })
        .mockResolvedValueOnce({ ok: true, data: {} }),
    };
    const encryption: any = { decrypt: jest.fn().mockReturnValue('token') };
    const config: any = { get: jest.fn().mockReturnValue('https://api.example') };
    const queue: any = { client: { eval: jest.fn().mockResolvedValue(0) } };
    const quota: any = { settle: jest.fn() };
    const service = new DmProcessorService(prisma, meta, encryption, config, quota, queue, { publish: jest.fn().mockResolvedValue(undefined) } as any);
    const job: any = {
      automationId: 'automation-1', igAccountId: 'account-1', triggerType: 'POST_COMMENT',
      commentId: 'comment-1', recipientIgsid: 'recipient-1', text: 'Here is the guide.',
      triggerEventId: 'comment:ig-user-1:comment-1',
    };
    const queueJob: any = { data: job, token: 'lock-token' };

    await expect(service.process(job, queueJob)).rejects.toThrow('Retryable Meta error');
    expect(run.status).toBe('PENDING');
    expect(run.publicReplyAttemptedAt).toBeInstanceOf(Date);
    expect(run.publicReplyError).toBeNull();

    await service.process(job, queueJob);

    expect(meta.replyToComment).toHaveBeenCalledTimes(1);
    expect(meta.sendCommentDm).toHaveBeenCalledTimes(2);
    expect(run.status).toBe('SENT');
    expect(quota.settle).toHaveBeenCalledWith(job.triggerEventId, true);
  });

  it('does not resend a delivery whose outcome is unknown', async () => {
    const prisma: any = {
      run: { findUnique: jest.fn().mockResolvedValue({ status: 'UNKNOWN' }) },
      automation: { findUnique: jest.fn() },
    };
    const meta: any = { sendDirectMessage: jest.fn(), sendCommentDm: jest.fn() };
    const quota: any = { settle: jest.fn() };
    const service = new DmProcessorService(prisma, meta, {} as any, {} as any, quota, {} as any, { publish: jest.fn().mockResolvedValue(undefined) } as any);

    await service.process({ triggerEventId: 'comment:ig-user:comment-1' } as any);

    expect(prisma.automation.findUnique).not.toHaveBeenCalled();
    expect(meta.sendDirectMessage).not.toHaveBeenCalled();
    expect(meta.sendCommentDm).not.toHaveBeenCalled();
    expect(quota.settle).not.toHaveBeenCalled();
  });

  it.each(['SKIPPED', 'FAILED'] as const)('releases quota for a terminal %s run', async (status) => {
    const prisma: any = {
      run: { upsert: jest.fn().mockResolvedValue({}) },
      automation: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const quota: any = { settle: jest.fn().mockResolvedValue(undefined) };
    const service = new DmProcessorService(prisma, {} as any, {} as any, {} as any, quota, {} as any, { publish: jest.fn().mockResolvedValue(undefined) } as any);
    const job: any = { triggerEventId: 'comment:ig-user:comment-1' };

    await (service as any).recordRun(job, 'contact-1', status, 'definite no-send');

    expect(quota.settle).toHaveBeenCalledWith(job.triggerEventId, false);
  });

  it('schedules follow-ups with queue-safe IDs and avoids an existing legacy ID', async () => {
    const dmQueue: any = { getJob: jest.fn().mockResolvedValue(null), add: jest.fn().mockResolvedValue({ remove: jest.fn() }) };
    const prisma: any = { automation: { findUnique: jest.fn().mockResolvedValue({ status: 'LIVE' }) } };
    const service = new DmProcessorService(prisma, {} as any, {} as any, {} as any, {} as any, dmQueue, { publish: jest.fn().mockResolvedValue(undefined) } as any);
    const followUps = [{ id: 'follow-up-1', order: 0, delayMinutes: 30 }];
    const job: any = { triggerEventId: 'comment:ig-user-1:comment-1', primarySentAt: '2026-11-21T00:00:00Z' };

    await (service as any).scheduleFollowUps(followUps, job);

    expect(dmQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ followUpId: 'follow-up-1' }),
      { jobId: expect.stringMatching(/^dm-[a-f0-9]{64}$/), delay: 30 * 60_000 },
    );
    dmQueue.add.mockClear();
    dmQueue.getJob.mockResolvedValueOnce({ id: 'legacy-job' });
    await (service as any).scheduleFollowUps(followUps, job);
    expect(dmQueue.add).not.toHaveBeenCalled();
  });

  it('marks an exhausted primary send as unknown without overwriting a known terminal result', async () => {
    const prisma: any = {
      run: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      automation: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new DmProcessorService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, { publish: jest.fn().mockResolvedValue(undefined) } as any);
    const job: any = { triggerEventId: 'message:ig-user:mid-1' };

    await service.markDeliveryUnknown(job, 'worker timed out');

    expect(prisma.run.updateMany).toHaveBeenCalledWith({
      where: { triggerEventId: job.triggerEventId, status: 'PENDING' },
      data: { status: 'UNKNOWN', error: expect.stringContaining('Delivery could not be confirmed after worker retries') },
    });
  });

  it('marks an exhausted follow-up run as unknown without overwriting a known terminal result', async () => {
    const prisma: any = { run: { updateMany: jest.fn() } };
    const service = new DmProcessorService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, { publish: jest.fn().mockResolvedValue(undefined) } as any);

    await service.markDeliveryUnknown({ triggerEventId: 'event-1', followUpId: 'follow-up-1' } as any, 'failed');

    expect(prisma.run.updateMany).toHaveBeenCalledWith({
      where: { triggerEventId: 'event-1:fu:follow-up-1', status: 'PENDING' },
      data: { status: 'UNKNOWN', error: expect.stringContaining('Delivery could not be confirmed after worker retries') },
    });
  });

  it('reconciles runs stuck pending for longer than the worker recovery window', async () => {
    const prisma: any = { run: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) } };
    const service = new DmProcessorService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, { publish: jest.fn().mockResolvedValue(undefined) } as any);

    await expect(service.markStalePendingRunsUnknown()).resolves.toBe(2);
    expect(prisma.run.updateMany).toHaveBeenCalledWith({
      where: { status: 'PENDING', createdAt: { lt: expect.any(Date) } },
      data: {
        status: 'UNKNOWN',
        error: 'Worker processing did not finish. Delivery could not be confirmed; check Instagram before retrying.',
      },
    });
  });

  it('records a scheduled follow-up as a separately keyed message run and claims quota', async () => {
    const primarySentAt = new Date(Date.now() - 60_000).toISOString();
    const responseAt = new Date(Date.now() - 30_000);
    const automation = {
      status: 'LIVE', triggerType: 'POST_COMMENT', matchMode: 'KEYWORDS', keywords: ['hello'],
      askToFollow: false, collectEmail: false, dailyLimit: 100, trackClicks: true,
      trackedLinks: [{ slug: 'follow-up-link', targetUrl: 'https://creator.example/follow-up' }],
      igAccount: { id: 'account-1', isActive: true, igUserId: 'ig-user-1', accessTokenEnc: 'encrypted', user: { id: 'user-1', plan: 'PRO' } },
    };
    const prisma: any = {
      run: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      automation: { findUnique: jest.fn().mockResolvedValue({ status: 'LIVE' }) },
      followUp: { findUnique: jest.fn().mockResolvedValue({ id: 'follow-up-1', order: 0, condition: 'DELAY', automationId: 'automation-1', dmBlocks: [
        { type: 'text', text: 'Checking in' },
        { type: 'buttons', buttons: [{ title: 'Open', url: 'https://creator.example/follow-up' }] },
      ], automation }) },
      igAccount: {
        findMany: jest.fn().mockResolvedValue([{ id: 'account-1' }]),
        findUnique: jest.fn().mockResolvedValue({ isActive: true, user: { deletionRequestedAt: null } }),
      },
      contact: {
        findUnique: jest.fn().mockResolvedValue({ id: 'contact-1', name: 'Creator fan', lastReplyAt: responseAt }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const meta: any = { sendDirectMessage: jest.fn().mockResolvedValue({ ok: true }) };
    const encryption: any = { decrypt: jest.fn().mockReturnValue('token') };
    const config: any = { get: jest.fn().mockReturnValue('https://api.example'), getOrThrow: jest.fn().mockReturnValue('test-attribution-key') };
    const quota: any = { consume: jest.fn().mockResolvedValue(true), settle: jest.fn() };
    const service = new DmProcessorService(prisma, meta, encryption, config, quota, {} as any, { publish: jest.fn().mockResolvedValue(undefined) } as any);

    await service.process({
      automationId: 'automation-1', igAccountId: 'account-1', triggerType: 'POST_COMMENT',
      commentId: 'comment-1', recipientIgsid: 'recipient-1', text: 'Primary', triggerEventId: 'comment:1', followUpId: 'follow-up-1', followUpOrder: 0,
      primarySentAt,
    });

    expect(quota.consume).toHaveBeenCalledWith('user-1', 'automation-1', 100, 'comment:1:fu:follow-up-1');
    expect(prisma.run.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.run.upsert.mock.calls[0][0].where.triggerEventId).toBe('comment:1:fu:follow-up-1');
    expect(prisma.run.upsert.mock.calls[0][0].create.followUpOrder).toBe(0);
    expect(prisma.run.upsert.mock.calls[1][0].create.status).toBe('SENT');
    expect(meta.sendDirectMessage).toHaveBeenCalledTimes(1);
    const sentButtons = meta.sendDirectMessage.mock.calls[0][4];
    expect(sentButtons).toHaveLength(1);
    expect(sentButtons[0].url).toMatch(/^https:\/\/api\.example\/r\/follow-up-link\?c=recipient-1&s=/);
    expect(config.getOrThrow).toHaveBeenCalledWith('ENCRYPTION_KEY');
    expect(quota.settle).toHaveBeenCalledWith('comment:1:fu:follow-up-1', true);
  });

  it('does not send a follow-up after a comment private reply when the commenter has not replied', async () => {
    const automation = {
      status: 'LIVE', triggerType: 'POST_COMMENT', matchMode: 'KEYWORDS', keywords: ['hello'],
      askToFollow: false, collectEmail: false, dailyLimit: 100,
      igAccount: { id: 'account-1', isActive: true, igUserId: 'ig-user-1', accessTokenEnc: 'encrypted', user: { id: 'user-1', plan: 'PRO' } },
    };
    const prisma: any = {
      run: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      automation: { findUnique: jest.fn().mockResolvedValue({ status: 'LIVE' }) },
      followUp: { findUnique: jest.fn().mockResolvedValue({ id: 'follow-up-1', order: 0, condition: 'LINK_NOT_CLICKED', automationId: 'automation-1', dmBlocks: [{ type: 'text', text: 'Checking in' }], automation }) },
      igAccount: {
        findMany: jest.fn().mockResolvedValue([{ id: 'account-1' }]),
        findUnique: jest.fn().mockResolvedValue({ isActive: true, user: { deletionRequestedAt: null } }),
      },
      contact: {
        findUnique: jest.fn().mockResolvedValue({ id: 'contact-1', name: 'Creator fan', lastReplyAt: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const meta: any = { sendDirectMessage: jest.fn() };
    const quota: any = { consume: jest.fn(), settle: jest.fn() };
    const service = new DmProcessorService(prisma, meta, {} as any, {} as any, quota, {} as any, { publish: jest.fn().mockResolvedValue(undefined) } as any);

    await service.process({
      automationId: 'automation-1', igAccountId: 'account-1', triggerType: 'POST_COMMENT',
      commentId: 'comment-1', recipientIgsid: 'recipient-1', text: 'Primary', triggerEventId: 'comment:1',
      followUpId: 'follow-up-1', followUpOrder: 0, primarySentAt: new Date(Date.now() - 60_000).toISOString(),
    });

    expect(meta.sendDirectMessage).not.toHaveBeenCalled();
    expect(quota.consume).not.toHaveBeenCalled();
    expect(prisma.run.upsert.mock.calls.at(-1)?.[0].create.error).toMatch(/only after the commenter responds/i);
  });

  it('does not create a run for a queued follow-up whose automation was deleted', async () => {
    const prisma: any = {
      run: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      followUp: { findUnique: jest.fn().mockResolvedValue(null) },
      automation: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new DmProcessorService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, { publish: jest.fn().mockResolvedValue(undefined) } as any);

    await service.process({ automationId: 'deleted-automation', igAccountId: 'account-1', followUpId: 'deleted-step', triggerEventId: 'event-1' } as any);

    expect(prisma.run.upsert).not.toHaveBeenCalled();
  });
});
