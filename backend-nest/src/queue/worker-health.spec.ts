import {
  deactivateLocalWorker,
  getWorkerHealth,
  hasFreshWorkerHeartbeat,
  isLocalWorkerActive,
  recordLocalWorkerHeartbeat,
  WORKER_HEARTBEAT_KEY,
} from './worker-health';

describe('worker health snapshot', () => {
  const now = 1_800_000_000_000;

  beforeEach(() => {
    deactivateLocalWorker();
  });

  function queueWithHeartbeat(value: string | null) {
    return {
      client: { get: jest.fn().mockResolvedValue(value) },
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 2, active: 1, delayed: 3, failed: 4 }),
      getWaiting: jest.fn().mockResolvedValue([{ timestamp: now - 75_000 }]),
      getDelayed: jest.fn().mockResolvedValue([{ timestamp: now - 120_000, delay: 30_000 }]),
    } as any;
  }

  it('reports a fresh worker heartbeat and queue counts', async () => {
    const queue = queueWithHeartbeat(String(now - 10_000));

    await expect(getWorkerHealth(queue, now)).resolves.toEqual({
      status: 'ok',
      lastHeartbeatAt: new Date(now - 10_000).toISOString(),
      heartbeatAgeMs: 10_000,
      queue: {
        waiting: 2, active: 1, delayed: 3, failed: 4,
        oldestWaitingAgeMs: 75_000,
        nextDelayedAt: new Date(now - 90_000).toISOString(),
        delayedOverdueMs: 90_000,
      },
    });
    expect(queue.client.get).toHaveBeenCalledWith(WORKER_HEARTBEAT_KEY);
    expect(queue.getWaiting).toHaveBeenCalledWith(0, 0);
    expect(queue.getDelayed).toHaveBeenCalledWith(0, 0);
  });

  it('returns null queue ages when there are no jobs and treats future delays as not overdue', async () => {
    const queue = queueWithHeartbeat(String(now));
    queue.getWaiting.mockResolvedValue([]);
    queue.getDelayed.mockResolvedValue([{ timestamp: now, delay: 30_000 }]);

    await expect(getWorkerHealth(queue, now)).resolves.toMatchObject({
      queue: {
        oldestWaitingAgeMs: null,
        nextDelayedAt: new Date(now + 30_000).toISOString(),
        delayedOverdueMs: 0,
      },
    });
  });

  it('ignores delayed-job timestamps outside the JavaScript date range', async () => {
    const queue = queueWithHeartbeat(String(now));
    queue.getWaiting.mockResolvedValue([{ timestamp: Number.MAX_VALUE }]);
    queue.getDelayed.mockResolvedValue([{ timestamp: Number.MAX_VALUE, delay: 0 }]);

    await expect(getWorkerHealth(queue, now)).resolves.toMatchObject({
      queue: { oldestWaitingAgeMs: null, nextDelayedAt: null, delayedOverdueMs: null },
    });
  });

  it.each([null, 'invalid', String(Number.MAX_VALUE), String(now - 46_000), String(now + 1_000)])(
    'marks absent, invalid, stale, or future heartbeat %s as stale', async (heartbeat) => {
      await expect(getWorkerHealth(queueWithHeartbeat(heartbeat), now)).resolves.toMatchObject({ status: 'stale' });
    },
  );
});

describe('hasFreshWorkerHeartbeat', () => {
  const now = 1_800_000_000_000;

  it('accepts a recent heartbeat and rejects missing, invalid, stale, or future values', async () => {
    const queueWithValue = (value: string | null) => ({
      client: { get: jest.fn().mockResolvedValue(value) },
    }) as any;

    await expect(hasFreshWorkerHeartbeat(queueWithValue(String(now - 15_000)), now)).resolves.toBe(true);
    for (const value of [null, 'invalid', String(now - 46_000), String(now + 1_000)]) {
      await expect(hasFreshWorkerHeartbeat(queueWithValue(value), now)).resolves.toBe(false);
    }
  });

  it('fails closed when Redis cannot provide the heartbeat', async () => {
    const queue = { client: Promise.reject(new Error('redis unavailable')) } as any;
    await expect(hasFreshWorkerHeartbeat(queue, now)).resolves.toBe(false);
  });

  it('reports healthy when in-process worker is active locally, even if Redis is unavailable', async () => {
    recordLocalWorkerHeartbeat();
    const rejectedPromise = Promise.reject(new Error('redis quota exceeded'));
    rejectedPromise.catch(() => {}); // prevent unhandled rejection in node
    const queue = {
      client: rejectedPromise,
      getJobCounts: jest.fn().mockRejectedValue(new Error('redis quota exceeded')),
      getWaiting: jest.fn().mockRejectedValue(new Error('redis quota exceeded')),
      getDelayed: jest.fn().mockRejectedValue(new Error('redis quota exceeded')),
    } as any;
    await expect(hasFreshWorkerHeartbeat(queue, Date.now())).resolves.toBe(true);
    await expect(getWorkerHealth(queue, Date.now())).resolves.toMatchObject({ status: 'ok' });
    deactivateLocalWorker();
    expect(isLocalWorkerActive()).toBe(false);
  });
});
