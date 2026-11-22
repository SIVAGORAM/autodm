import { Queue } from 'bullmq';
import { QueueShutdown } from './queue.module';

describe('QueueShutdown', () => {
  it('closes the producer queue during application shutdown', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const lifecycle = new QueueShutdown({ close } as unknown as Queue);

    await lifecycle.onApplicationShutdown();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
