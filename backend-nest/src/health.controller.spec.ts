import { HealthController } from './health.controller';

describe('HealthController readiness', () => {
  function setup(
    database: () => Promise<unknown>, redis: () => Promise<unknown>, throttlePing = () => Promise.resolve(true),
    requireNoeviction = false, memoryInfo = '# Memory\r\nmaxmemory_policy:noeviction\r\n',
  ) {
    const prisma: any = { $queryRaw: database };
    const queue: any = { getJobCounts: redis, client: Promise.resolve({ info: jest.fn().mockResolvedValue(memoryInfo) }) };
    const response: any = { status: jest.fn() };
    return { controller: new HealthController(prisma, queue, { ping: throttlePing }, { get: () => requireNoeviction } as any), response };
  }

  it('reports ready only when database and queue both respond', async () => {
    const { controller, response } = setup(() => Promise.resolve([{ '?column?': 1 }]), () => Promise.resolve({ waiting: 0 }));

    const result = await controller.ready(response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(result.status).toBe('ready');
    expect(result.checks).toEqual({ database: 'ok', queue: 'ok', throttling: 'ok', redisQueuePolicy: 'not_required' });
  });

  it('returns 503 without exposing infrastructure errors when a dependency fails', async () => {
    const { controller, response } = setup(() => Promise.reject(new Error('private database host')), () => Promise.resolve({ waiting: 0 }));

    const result = await controller.ready(response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result.status).toBe('not_ready');
    expect(result.checks).toEqual({ database: 'unavailable', queue: 'ok', throttling: 'ok', redisQueuePolicy: 'not_required' });
    expect(JSON.stringify(result)).not.toContain('private database host');
  });

  it('reports not ready when the shared throttler Redis connection is unavailable', async () => {
    const { controller, response } = setup(
      () => Promise.resolve([{ '?column?': 1 }]),
      () => Promise.resolve({ waiting: 0 }),
      () => Promise.resolve(false),
    );

    const result = await controller.ready(response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result.checks).toEqual({ database: 'ok', queue: 'ok', throttling: 'unavailable', redisQueuePolicy: 'not_required' });
  });

  it('fails readiness when production requires noeviction but Redis reports an eviction policy', async () => {
    const { controller, response } = setup(
      () => Promise.resolve([{ '?column?': 1 }]), () => Promise.resolve({ waiting: 0 }),
      () => Promise.resolve(true), true, '# Memory\r\nmaxmemory_policy:volatile-lru\r\n',
    );

    const result = await controller.ready(response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result.checks.redisQueuePolicy).toBe('unsafe_or_unavailable');
  });

  it('reports queue-safe readiness when Redis confirms noeviction', async () => {
    const { controller, response } = setup(
      () => Promise.resolve([{ '?column?': 1 }]), () => Promise.resolve({ waiting: 0 }),
      () => Promise.resolve(true), true,
    );

    const result = await controller.ready(response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(result.checks.redisQueuePolicy).toBe('ok');
  });

  it('exposes stale worker state to the operator probe without failing API readiness', async () => {
    const queue: any = {
      client: { get: jest.fn().mockResolvedValue(null) },
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 8, active: 0, delayed: 0, failed: 1 }),
      getWaiting: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
    };
    const controller = new HealthController({} as any, queue, { ping: jest.fn().mockResolvedValue(true) }, { get: () => false } as any);
    const response: any = { status: jest.fn() };

    const result = await controller.worker(response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result.status).toBe('stale');
    expect(result).toMatchObject({ queue: { waiting: 8 } });
    expect(result).not.toHaveProperty('database');
  });

  it('does not expose Redis errors from the operator probe', async () => {
    const queue: any = {
      client: { get: jest.fn().mockRejectedValue(new Error('private redis host')) },
      getJobCounts: jest.fn().mockResolvedValue({}),
      getWaiting: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
    };
    const controller = new HealthController({} as any, queue, { ping: jest.fn().mockResolvedValue(true) }, { get: () => false } as any);
    const response: any = { status: jest.fn() };

    const result = await controller.worker(response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result.status).toBe('unavailable');
    expect(JSON.stringify(result)).not.toContain('private redis host');
  });

  it('exposes only creator-safe worker availability and timestamp', async () => {
    const queue: any = {
      client: { get: jest.fn().mockResolvedValue(String(Date.now())) },
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 8, active: 2, delayed: 3, failed: 1 }),
      getWaiting: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
    };
    const controller = new HealthController({} as any, queue, { ping: jest.fn().mockResolvedValue(true) }, { get: () => false } as any);

    const result = await controller.creatorWorkerStatus();

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('ok');
    expect(result.data.lastHeartbeatAt).toEqual(expect.any(String));
    expect(result.data).not.toHaveProperty('queue');
  });

  it('returns a safe unavailable state when creator worker status cannot be read', async () => {
    const queue: any = {
      client: { get: jest.fn().mockRejectedValue(new Error('private redis host')) },
      getJobCounts: jest.fn().mockResolvedValue({}),
      getWaiting: jest.fn().mockResolvedValue([]),
      getDelayed: jest.fn().mockResolvedValue([]),
    };
    const controller = new HealthController({} as any, queue, { ping: jest.fn().mockResolvedValue(true) }, { get: () => false } as any);

    const result = await controller.creatorWorkerStatus();

    expect(result).toEqual({ success: true, data: { status: 'unavailable', lastHeartbeatAt: null } });
    expect(JSON.stringify(result)).not.toContain('private redis host');
  });
});
