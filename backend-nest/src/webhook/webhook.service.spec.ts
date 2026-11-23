import { Prisma } from '@prisma/client';
import { WebhookService } from './webhook.service';

const payload = {
  entry: [{
    id: 'ig-business-1',
    changes: [{ field: 'comments', value: { id: 'comment-1', text: 'guide', from: { id: 'person-1' } } }],
  }],
};

function setup() {
  const prisma: any = {
    igAccount: {
      findMany: jest.fn().mockResolvedValue([{ id: 'account-row-1', igUserId: 'ig-business-1' }]),
      findUnique: jest.fn().mockResolvedValue({ isActive: true, user: { deletionRequestedAt: null, suspendedAt: null } }),
    },
    webhookEvent: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([{
        id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', payload,
        processedAt: null, nextAttemptAt: null, deadLetterAt: null,
      }]),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({ attempts: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    adminAuditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    $transaction: jest.fn((operation: any) => operation(prisma)),
  };
  const queue: any = { getJob: jest.fn().mockResolvedValue(null), addBulk: jest.fn().mockResolvedValue([{ id: 'job-1' }]) };
  const dashboardEvents = { publish: jest.fn().mockResolvedValue(undefined) };
  return { prisma, queue, dashboardEvents, service: new WebhookService(
    prisma, queue, { consume: jest.fn() } as any, dashboardEvents as any,
    { getCommentMetadata: jest.fn().mockResolvedValue({ mediaId: null, createdAt: '2026-11-20T10:00:00.000Z' }) } as any,
    { decrypt: jest.fn().mockReturnValue('provider-token') } as any,
  ) };
}

describe('WebhookService durable intake', () => {
  it('throttles only after the invalid-signature threshold using a hashed IP key', async () => {
    const { queue, service } = setup();
    const evalScript = jest.fn().mockResolvedValue(31);
    queue.client = Promise.resolve({ eval: evalScript });

    await expect(service.shouldThrottleInvalidSignature('203.0.113.10')).resolves.toBe(true);

    expect(evalScript).toHaveBeenCalledWith(expect.stringContaining("redis.call('INCR'"), 1,
      expect.stringMatching(/^webhook:invalid-signature:[a-f0-9]{64}$/), '60');
    expect(evalScript.mock.calls[0][2]).not.toContain('203.0.113.10');
  });

  it('fails closed on the request when the invalid-signature counter is unavailable', async () => {
    const { queue, service } = setup();
    queue.client = Promise.resolve({ eval: jest.fn().mockRejectedValue(new Error('redis unavailable')) });

    await expect(service.shouldThrottleInvalidSignature('203.0.113.10')).resolves.toBe(false);
  });

  it('schedules comment follow-ups from the commenter response timestamp', async () => {
    const replyAt = new Date(Date.now() + 1_000);
    const primary = {
      automationId: 'automation-1',
      triggerEventId: 'comment:ig-business-1:comment-1',
      sentAt: new Date(replyAt.getTime() - 60 * 60_000),
      automation: {
        id: 'automation-1', status: 'LIVE', triggerType: 'POST_COMMENT',
        dmBlocks: [{ type: 'text', text: 'Primary message' }],
        followUps: [{ id: 'follow-up-1', order: 0, delayMinutes: 15 }],
      },
    };
    const prisma: any = {
      run: {
        findFirst: jest.fn().mockResolvedValue(primary),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const queue: any = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue({ id: 'follow-up-job' }),
    };
    const service = new WebhookService(prisma, queue, {} as any, { publish: jest.fn().mockResolvedValue(undefined) } as any, {} as any, {} as any);

    await (service as any).scheduleCommentFollowUps(
      { id: 'account-row-1', igUserId: 'ig-business-1' },
      { id: 'contact-1', igScopedId: 'person-1', username: 'viewer' },
      replyAt,
    );

    expect(prisma.run.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        igAccountId: 'account-row-1', contactId: 'contact-1', status: 'SENT',
        sentAt: { lte: replyAt },
        triggerEventId: { startsWith: 'comment:ig-business-1:' },
      }),
    }));
    expect(queue.add).toHaveBeenCalledWith('send', expect.objectContaining({
      commentId: 'comment-1',
      triggerEventId: 'comment:ig-business-1:comment-1',
      followUpId: 'follow-up-1',
      primarySentAt: primary.sentAt.toISOString(),
      replyReceivedAt: replyAt.toISOString(),
    }), expect.objectContaining({
      jobId: expect.stringMatching(/^dm-[a-f0-9]{64}$/),
      delay: expect.any(Number),
    }));
    const delay = queue.add.mock.calls[0][2].delay;
    expect(delay).toBeGreaterThan(14 * 60_000);
    expect(delay).toBeLessThanOrEqual(15 * 60_000 + 1_000);
  });

  it('uses a queue-safe hashed send ID and respects a legacy in-flight ID during rollout', async () => {
    const { queue, service } = setup();
    queue.add = jest.fn().mockResolvedValue({ id: 'dm-job' });
    const job = { triggerEventId: 'comment:ig-business-1:comment-1', igAccountId: 'account-row-1' } as any;

    await (service as any).enqueue(job);

    expect(queue.add).toHaveBeenCalledWith('send', job, { jobId: expect.stringMatching(/^dm-[a-f0-9]{64}$/) });
    queue.getJob.mockResolvedValueOnce({ id: job.triggerEventId });
    await (service as any).enqueue(job);
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('persists the durable receipt before bulk-enqueueing the worker job', async () => {
    const { prisma, queue, service } = setup();

    await service.accept(payload);

    expect(prisma.webhookEvent.createMany).toHaveBeenCalledWith({
      data: [{ eventId: 'comment:ig-business-1:comment-1', igUserId: 'ig-business-1', igAccountId: 'account-row-1', payload: expect.any(Object) }],
      skipDuplicates: true,
    });
    expect(prisma.webhookEvent.createMany.mock.invocationCallOrder[0]).toBeLessThan(queue.addBulk.mock.invocationCallOrder[0]);
    expect(queue.addBulk).toHaveBeenCalledWith([{
      name: 'process-webhook-event',
      data: { webhookEventId: 'event-row-1' },
      opts: { jobId: expect.stringMatching(/^wh-[a-f0-9]{64}$/), attempts: 1 },
    }]);
  });

  it('persists and queues a story-reply message as one durable, deduplicated event', async () => {
    const { prisma, queue, service } = setup();
    const message = {
      sender: { id: 'viewer-1' },
      recipient: { id: 'ig-business-1' },
      timestamp: 1790000000000,
      message: {
        mid: 'story-reply-1',
        text: 'guide please',
        reply_to: { story: { id: 'story-1', url: 'https://example.test/story' } },
      },
    };
    prisma.webhookEvent.findMany.mockResolvedValue([{
      id: 'message-event-row', eventId: 'message:ig-business-1:story-reply-1',
      payload: { entry: [{ id: 'ig-business-1', messaging: [message] }] },
      processedAt: null, nextAttemptAt: null, deadLetterAt: null,
    }]);

    await service.accept({ entry: [{ id: 'ig-business-1', messaging: [message, message] }] });

    expect(prisma.webhookEvent.createMany).toHaveBeenCalledWith({
      data: [{
        eventId: 'message:ig-business-1:story-reply-1',
        igUserId: 'ig-business-1',
        igAccountId: 'account-row-1',
        payload: { entry: [{ id: 'ig-business-1', messaging: [message] }] },
      }],
      skipDuplicates: true,
    });
    expect(prisma.webhookEvent.createMany.mock.invocationCallOrder[0]).toBeLessThan(queue.addBulk.mock.invocationCallOrder[0]);
    expect(queue.addBulk).toHaveBeenCalledWith([{
      name: 'process-webhook-event',
      data: { webhookEventId: 'message-event-row' },
      opts: { jobId: expect.stringMatching(/^wh-[a-f0-9]{64}$/), attempts: 1 },
    }]);
  });

  it('normalizes the documented comment_id payload shape before storing the durable event', async () => {
    const { prisma, queue, service } = setup();
    prisma.webhookEvent.findMany.mockResolvedValue([{
      id: 'event-row-2', eventId: 'comment:ig-business-1:comment-current', payload: {},
      processedAt: null, nextAttemptAt: null, deadLetterAt: null,
    }]);
    const reelComment = {
      field: 'comments',
      value: {
        comment_id: 'comment-current', text: 'guide', from: { id: 'person-2', username: 'viewer' },
        media: { id: 'reel-1', media_product_type: 'REELS' },
      },
    };

    await service.accept({ entry: [{ id: 'ig-business-1', changes: [reelComment] }] });

    expect(prisma.webhookEvent.createMany).toHaveBeenCalledWith({
      data: [{
        eventId: 'comment:ig-business-1:comment-current', igUserId: 'ig-business-1', igAccountId: 'account-row-1',
        payload: { entry: [{ id: 'ig-business-1', changes: [{ ...reelComment, value: { ...reelComment.value, id: 'comment-current' } }] }] },
      }],
      skipDuplicates: true,
    });
    expect(queue.addBulk).toHaveBeenCalledTimes(1);
  });

  it('expands documented comment value arrays into independently deduplicated events', async () => {
    const { prisma, service } = setup();
    prisma.webhookEvent.findMany.mockResolvedValue([]);

    await service.accept({ entry: [{ id: 'ig-business-1', changes: [{ field: 'comments', value: [
      { comment_id: 'comment-a', from: { id: 'person-a' } },
      { id: 'comment-b', from: { id: 'person-b' } },
    ] }] }] });

    expect(prisma.webhookEvent.createMany.mock.calls[0][0].data.map((event: any) => event.eventId)).toEqual([
      'comment:ig-business-1:comment-a', 'comment:ig-business-1:comment-b',
    ]);
  });

  it('does not enqueue a second job while the event job is already waiting', async () => {
    const { queue, service } = setup();
    queue.getJob.mockResolvedValue({ getState: jest.fn().mockResolvedValue('waiting') });

    await service.accept(payload);

    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('stores and enqueues a multi-event provider batch with one database insert and one queue batch', async () => {
    const { prisma, queue, service } = setup();
    const secondId = 'comment:ig-business-1:comment-2';
    prisma.webhookEvent.findMany.mockResolvedValue([
      { id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', payload, processedAt: null, nextAttemptAt: null, deadLetterAt: null },
      { id: 'event-row-2', eventId: secondId, payload, processedAt: null, nextAttemptAt: null, deadLetterAt: null },
    ]);
    const batch = {
      entry: [{
        id: 'ig-business-1',
        changes: [
          { field: 'comments', value: { id: 'comment-1', text: 'guide' } },
          { field: 'comments', value: { id: 'comment-2', text: 'tips' } },
        ],
      }],
    };

    await service.accept(batch);

    expect(prisma.webhookEvent.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.webhookEvent.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(queue.addBulk).toHaveBeenCalledTimes(1);
    expect(queue.addBulk.mock.calls[0][0]).toHaveLength(2);
  });

  it('keeps a 1000-update provider batch on the bulk intake path', async () => {
    const { prisma, queue, service } = setup();
    const changes = Array.from({ length: 1000 }, (_, index) => ({
      field: 'comments', value: { id: `comment-${index}`, text: 'hello' },
    }));
    prisma.webhookEvent.findMany.mockResolvedValue(changes.map((change, index) => ({
      id: `event-row-${index}`, eventId: `comment:ig-business-1:${change.value.id}`,
      payload: { entry: [{ id: 'ig-business-1', changes: [change] }] },
      processedAt: null, nextAttemptAt: null, deadLetterAt: null,
    })));

    await service.accept({ entry: [{ id: 'ig-business-1', changes }] });

    expect(prisma.webhookEvent.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.webhookEvent.createMany.mock.calls[0][0].data).toHaveLength(1000);
    expect(queue.addBulk).toHaveBeenCalledTimes(1);
    expect(queue.addBulk.mock.calls[0][0]).toHaveLength(1000);
  });

  it('marks processed events and clears stored customer payloads', async () => {
    const { prisma, service, dashboardEvents } = setup();
    const row = { id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', igUserId: 'ig-business-1', igAccountId: 'account-row-1', payload, processedAt: null, deadLetterAt: null };
    prisma.webhookEvent.findUnique.mockResolvedValue(row);
    prisma.igAccount.findUnique.mockResolvedValueOnce({
      isActive: true, userId: 'owner-1', user: { deletionRequestedAt: null, suspendedAt: null },
    });
    const handle = jest.spyOn(service, 'handle').mockResolvedValue();

    await service.processEvent(row.id);

    expect(handle).toHaveBeenCalledWith(payload);
    expect(prisma.webhookEvent.update).toHaveBeenLastCalledWith({
      where: { id: row.id },
      data: { processedAt: expect.any(Date), payload: Prisma.DbNull, lastError: null },
    });
    expect(dashboardEvents.publish).toHaveBeenCalledWith('owner-1', 'instagram');
    const finalDatabaseUpdateOrder = prisma.webhookEvent.update.mock.invocationCallOrder[prisma.webhookEvent.update.mock.invocationCallOrder.length - 1];
    expect(finalDatabaseUpdateOrder).toBeLessThan(dashboardEvents.publish.mock.invocationCallOrder[0]);
  });

  it('does not write Instagram account or comment identifiers into dead-letter logs', async () => {
    const { prisma, service } = setup();
    const row = {
      id: 'event-row-1', eventId: 'comment:private-ig-id:private-comment-id', igUserId: 'private-ig-id',
      igAccountId: 'account-row-1', payload, processedAt: null, deadLetterAt: null,
    };
    prisma.webhookEvent.findUnique.mockResolvedValue(row);
    prisma.webhookEvent.update.mockResolvedValueOnce({ attempts: 8 });
    const handle = jest.spyOn(service, 'handle').mockRejectedValue(new Error('provider details'));
    const errorLog = jest.spyOn((service as any).log, 'error').mockImplementation();

    await expect(service.processEvent(row.id)).rejects.toThrow('provider details');

    expect(errorLog).toHaveBeenCalledWith('Instagram comment webhook moved to dead letter after 8 attempts');
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain('private-ig-id');
    expect(errorLog.mock.calls.flat().join(' ')).not.toContain('private-comment-id');
    handle.mockRestore();
  });

  it('stores retry timing for a transient comment-processing failure', async () => {
    const { prisma, service } = setup();
    const row = {
      id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', igUserId: 'ig-business-1',
      igAccountId: 'account-row-1', payload, processedAt: null, deadLetterAt: null,
    };
    prisma.webhookEvent.findUnique.mockResolvedValue(row);
    prisma.igAccount.findUnique.mockResolvedValue({
      isActive: true, userId: 'owner-1', user: { deletionRequestedAt: null, suspendedAt: null },
    });
    prisma.webhookEvent.update.mockResolvedValueOnce({ attempts: 1 });
    const handle = jest.spyOn(service, 'handle').mockRejectedValue(new Error('provider request failed'));

    await expect(service.processEvent(row.id)).rejects.toThrow('provider request failed');

    expect(prisma.webhookEvent.update).toHaveBeenLastCalledWith({
      where: { id: row.id },
      data: {
        lastError: 'Webhook processing failed (Error)',
        nextAttemptAt: expect.any(Date),
        deadLetterAt: null,
      },
    });
    handle.mockRestore();
  });

  it('clears a pending payload without handling it when its account has been disabled', async () => {
    const { prisma, service } = setup();
    const row = { id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', igUserId: 'ig-business-1', igAccountId: 'account-row-1', payload, processedAt: null, deadLetterAt: null };
    prisma.webhookEvent.findUnique.mockResolvedValue(row);
    prisma.igAccount.findUnique.mockResolvedValue({ isActive: false, user: { deletionRequestedAt: new Date() } });
    const handle = jest.spyOn(service, 'handle').mockResolvedValue();

    await service.processEvent(row.id);

    expect(handle).not.toHaveBeenCalled();
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: { processedAt: expect.any(Date), payload: Prisma.DbNull, lastError: null },
    });
  });

  it('lists dead-letter metadata without returning provider IDs or customer payloads', async () => {
    const { prisma, service } = setup();
    prisma.webhookEvent.findMany.mockResolvedValueOnce([{
      id: 'event-row-1', eventId: 'comment:private-ig-id:comment-1', attempts: 8, redriveCount: 1,
      lastError: 'Webhook processing failed (Error)', createdAt: new Date(), deadLetterAt: new Date(),
      lastRedrivenAt: new Date(), payloadPurgedAt: null, igAccount: { username: 'creator' },
    }]);

    const result = await service.listDeadLetters();

    expect(result.events[0]).toMatchObject({ id: 'event-row-1', type: 'comment', instagramAccount: 'creator', attempts: 8 });
    expect(result.events[0]).not.toHaveProperty('eventId');
    expect(result.events[0]).not.toHaveProperty('payload');
    expect(result.events[0].payloadAvailable).toBe(true);
    expect(prisma.webhookEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deadLetterAt: { not: null }, processedAt: null },
      take: 51,
    }));
  });

  it('resets retry state, records the administrator, and requeues a dead-letter event', async () => {
    const { prisma, queue, service } = setup();
    const deadLetterAt = new Date('2026-01-01T00:00:00Z');
    prisma.webhookEvent.findUnique.mockResolvedValueOnce({
      id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', payload,
      attempts: 8, redriveCount: 2, processedAt: null, deadLetterAt,
      igAccount: { isActive: true, user: { deletionRequestedAt: null } },
    });

    const result = await service.redriveDeadLetter('event-row-1', 'admin-1', 'Retry the transient subscription failure');

    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'event-row-1', deadLetterAt, processedAt: null, attempts: 8, payloadPurgedAt: null },
      data: expect.objectContaining({
        attempts: 0, deadLetterAt: null, lastRedrivenBy: 'admin-1', redriveCount: { increment: 1 },
      }),
    });
    expect(prisma.adminAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      actorId: 'admin-1', action: 'WEBHOOK_DEAD_LETTER_REDRIVEN', targetId: 'event-row-1',
      reason: 'Retry the transient subscription failure',
    }) }));
    expect(queue.addBulk).toHaveBeenCalledWith([expect.objectContaining({
      data: { webhookEventId: 'event-row-1' }, name: 'process-webhook-event',
    })]);
    expect(result).toEqual({ status: 'queued', redriveCount: 3 });
  });

  it('does not redrive while the existing webhook job is active', async () => {
    const { prisma, queue, service } = setup();
    prisma.webhookEvent.findUnique.mockResolvedValueOnce({
      id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', payload,
      attempts: 8, redriveCount: 0, processedAt: null, deadLetterAt: new Date(),
      igAccount: { isActive: true, user: { deletionRequestedAt: null } },
    });
    queue.getJob.mockResolvedValueOnce({ getState: jest.fn().mockResolvedValue('active') });

    await expect(service.redriveDeadLetter('event-row-1', 'admin-1', 'Retry the transient subscription failure')).rejects.toThrow('still being processed');
    expect(prisma.webhookEvent.updateMany).not.toHaveBeenCalled();
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('does not redrive receipts for inactive accounts', async () => {
    const { prisma, service } = setup();
    prisma.webhookEvent.findUnique.mockResolvedValueOnce({
      id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', payload,
      attempts: 8, redriveCount: 0, processedAt: null, deadLetterAt: new Date(),
      igAccount: { isActive: false, user: { deletionRequestedAt: null } },
    });

    await expect(service.redriveDeadLetter('event-row-1', 'admin-1', 'Retry the transient subscription failure')).rejects.toThrow('account is unavailable');
    expect(prisma.webhookEvent.updateMany).not.toHaveBeenCalled();
  });

  it('does not redrive receipts for accounts being deleted', async () => {
    const { prisma, service } = setup();
    prisma.webhookEvent.findUnique.mockResolvedValueOnce({
      id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', payload,
      attempts: 8, redriveCount: 0, processedAt: null, deadLetterAt: new Date(),
      igAccount: { isActive: true, user: { deletionRequestedAt: new Date() } },
    });

    await expect(service.redriveDeadLetter('event-row-1', 'admin-1', 'Retry the transient subscription failure')).rejects.toThrow('account is unavailable');
    expect(prisma.webhookEvent.updateMany).not.toHaveBeenCalled();
  });

  it('uses a conditional claim so concurrent administrator requests cannot enqueue twice', async () => {
    const { prisma, queue, service } = setup();
    prisma.webhookEvent.findUnique.mockResolvedValueOnce({
      id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', payload,
      attempts: 8, redriveCount: 0, processedAt: null, deadLetterAt: new Date(),
      igAccount: { isActive: true, user: { deletionRequestedAt: null } },
    });
    prisma.webhookEvent.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.redriveDeadLetter('event-row-1', 'admin-1', 'Retry the transient subscription failure')).rejects.toThrow('changed while redrive');
    expect(queue.addBulk).not.toHaveBeenCalled();
  });

  it('leaves a durable pending receipt for scheduled recovery when Redis enqueue fails', async () => {
    const { prisma, queue, service } = setup();
    prisma.webhookEvent.findUnique.mockResolvedValueOnce({
      id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', payload,
      attempts: 8, redriveCount: 0, processedAt: null, deadLetterAt: new Date(),
      igAccount: { isActive: true, user: { deletionRequestedAt: null } },
    });
    queue.addBulk.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.redriveDeadLetter('event-row-1', 'admin-1', 'Retry the transient subscription failure')).resolves.toEqual({ status: 'pending_recovery', redriveCount: 1 });
    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledTimes(1);
  });

  it('purges only dead-letter payloads older than the configured retention while keeping receipt IDs', async () => {
    const { prisma, service } = setup();
    prisma.webhookEvent.updateMany.mockResolvedValueOnce({ count: 4 });

    await expect(service.purgeExpiredDeadLetterPayloads(30)).resolves.toBe(4);

    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { deadLetterAt: { lte: expect.any(Date) }, processedAt: null, payloadPurgedAt: null },
      data: {
        payload: Prisma.DbNull,
        payloadPurgedAt: expect.any(Date),
        lastError: 'Webhook payload purged under retention policy.',
      },
    });
  });

  it('rejects redrive after the webhook payload has expired', async () => {
    const { prisma, service } = setup();
    prisma.webhookEvent.findUnique.mockResolvedValueOnce({
      id: 'event-row-1', eventId: 'comment:ig-business-1:comment-1', payload: null,
      attempts: 8, redriveCount: 0, processedAt: null, deadLetterAt: new Date(), payloadPurgedAt: new Date(),
      igAccount: { isActive: true, user: { deletionRequestedAt: null } },
    });

    await expect(service.redriveDeadLetter('event-row-1', 'admin-1', 'Retry the transient subscription failure')).rejects.toThrow('no longer eligible');
    expect(prisma.webhookEvent.updateMany).not.toHaveBeenCalled();
  });
});
