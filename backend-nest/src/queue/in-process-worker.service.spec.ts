import { InProcessWorkerService } from './in-process-worker.service';

describe('InProcessWorkerService', () => {
  let service: InProcessWorkerService;
  let config: any;
  let queue: any;
  let processor: any;
  let webhook: any;

  beforeEach(() => {
    config = {
      get: jest.fn().mockImplementation((key: string, def?: any) => {
        if (key === 'ENABLE_IN_PROCESS_WORKER') return 'true';
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        return def;
      }),
    };
    queue = {
      client: Promise.resolve({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      }),
    };
    processor = { process: jest.fn() };
    webhook = { processEvent: jest.fn() };

    service = new InProcessWorkerService(config, queue, processor, webhook);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('skips auto-starting in test environment by default', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    delete process.env.ENABLE_IN_PROCESS_WORKER;

    await service.onApplicationBootstrap();
    expect(config.get).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('shuts down cleanly without errors', async () => {
    await expect(service.onApplicationShutdown()).resolves.not.toThrow();
  });
});
