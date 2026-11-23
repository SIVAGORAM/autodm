import { processDmQueueJob } from './worker-job-handler';

describe('processDmQueueJob', () => {
  it('dispatches durable webhook jobs to the webhook processor', async () => {
    const job = { name: 'process-webhook-event', data: { webhookEventId: 'receipt-1' } } as any;
    const webhook = { processEvent: jest.fn().mockResolvedValue(undefined) } as any;
    const dm = { process: jest.fn().mockResolvedValue(undefined) } as any;

    await processDmQueueJob(job, webhook, dm);

    expect(webhook.processEvent).toHaveBeenCalledWith('receipt-1');
    expect(dm.process).not.toHaveBeenCalled();
  });

  it('discards malformed webhook jobs instead of retrying an invalid receipt id', async () => {
    const job = { name: 'process-webhook-event', data: {}, discard: jest.fn() } as any;
    const webhook = { processEvent: jest.fn() } as any;
    const dm = { process: jest.fn() } as any;

    await expect(processDmQueueJob(job, webhook, dm)).rejects.toThrow('Invalid process-webhook-event job payload');

    expect(job.discard).toHaveBeenCalledTimes(1);
    expect(webhook.processEvent).not.toHaveBeenCalled();
    expect(dm.process).not.toHaveBeenCalled();
  });

  it('dispatches delivery jobs with the BullMQ job metadata to the DM processor', async () => {
    const job = {
      name: 'send',
      data: {
        automationId: 'automation-1', igAccountId: 'account-1', triggerType: 'POST_COMMENT',
        recipientIgsid: 'viewer-1', text: 'Hello', triggerEventId: 'comment:account:comment',
      },
    } as any;
    const webhook = { processEvent: jest.fn() } as any;
    const dm = { process: jest.fn().mockResolvedValue(undefined) } as any;

    await processDmQueueJob(job, webhook, dm);

    expect(dm.process).toHaveBeenCalledWith(job.data, job);
    expect(webhook.processEvent).not.toHaveBeenCalled();
  });

  it('discards unknown job names instead of routing them to the DM sender', async () => {
    const job = { name: 'unexpected-job', data: { triggerEventId: 'not-a-send' }, discard: jest.fn() } as any;
    const webhook = { processEvent: jest.fn() } as any;
    const dm = { process: jest.fn() } as any;

    await expect(processDmQueueJob(job, webhook, dm)).rejects.toThrow('Unsupported DM queue job');

    expect(job.discard).toHaveBeenCalledTimes(1);
    expect(webhook.processEvent).not.toHaveBeenCalled();
    expect(dm.process).not.toHaveBeenCalled();
  });

  it('discards malformed send payloads before delivery processing', async () => {
    const job = { name: 'send', data: { automationId: 'automation-1', recipientIgsid: 'viewer-1' }, discard: jest.fn() } as any;
    const webhook = { processEvent: jest.fn() } as any;
    const dm = { process: jest.fn() } as any;

    await expect(processDmQueueJob(job, webhook, dm)).rejects.toThrow('Invalid send job payload');

    expect(job.discard).toHaveBeenCalledTimes(1);
    expect(webhook.processEvent).not.toHaveBeenCalled();
    expect(dm.process).not.toHaveBeenCalled();
  });
});
