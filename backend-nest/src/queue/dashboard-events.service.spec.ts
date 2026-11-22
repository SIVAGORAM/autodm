import { EventEmitter } from 'node:events';
import { DashboardEventsService } from './dashboard-events.service';

class FakeRedis extends EventEmitter {
  subscribe = jest.fn(async () => 1);
  unsubscribe = jest.fn(async () => 1);
  quit = jest.fn(async () => 'OK');
  duplicate = jest.fn(() => this);
  publish = jest.fn(async (channel: string, message: string) => {
    this.emit('message', channel, message);
    return 1;
  });
}

describe('DashboardEventsService', () => {
  it('delivers invalidations only to streams owned by the matching user', async () => {
    const redis = new FakeRedis();
    const queue = { client: Promise.resolve(redis) } as any;
    const service = new DashboardEventsService(queue);
    const ownerEvents: unknown[] = [];
    const otherEvents: unknown[] = [];
    const ownerSubscription = service.stream('owner-1').subscribe((event) => ownerEvents.push(event));
    const otherSubscription = service.stream('owner-2').subscribe((event) => otherEvents.push(event));
    await new Promise<void>((resolve) => setImmediate(resolve));

    await service.publish('owner-1', 'delivery');

    expect(ownerEvents).toEqual([{ type: 'invalidate', data: { resource: 'delivery', at: expect.any(Number) } }]);
    expect(otherEvents).toEqual([]);
    ownerSubscription.unsubscribe();
    otherSubscription.unsubscribe();
    await service.onApplicationShutdown();
    expect(redis.unsubscribe).toHaveBeenCalledWith('heylaunch:dashboard-events:v1');
    expect(redis.quit).toHaveBeenCalled();
  });

  it('ignores unknown event categories and never serializes a user id to the browser', async () => {
    const redis = new FakeRedis();
    const service = new DashboardEventsService({ client: Promise.resolve(redis) } as any);
    const events: unknown[] = [];
    const subscription = service.stream('owner-1').subscribe((event) => events.push(event));
    await new Promise<void>((resolve) => setImmediate(resolve));

    await service.publish('owner-1', 'delivery');
    await service.publish('owner-1', 'secret' as any);

    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).not.toContain('owner-1');
    expect(redis.publish).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
    await service.onApplicationShutdown();
  });

  it('treats Redis publication failure as best-effort and does not throw', async () => {
    const redis = new FakeRedis();
    redis.publish.mockRejectedValueOnce(new Error('connection string must not be logged'));
    const service = new DashboardEventsService({ client: Promise.resolve(redis) } as any);
    const warn = jest.spyOn((service as any).log, 'warn').mockImplementation(() => undefined);

    await expect(service.publish('owner-1', 'delivery')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Dashboard event publish unavailable'));
  });
});
