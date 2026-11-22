import { DelayedError, Job, Queue } from 'bullmq';
import { DmJob } from './queue.constants';
import { reserveCommentPrivateReply } from './instagram-rate-limiter';

describe('Instagram private reply limiter', () => {
  const payload = { igAccountId: 'account-1' } as DmJob;

  function setup(waitMs: number) {
    const evalScript = jest.fn().mockResolvedValue(waitMs);
    const redis = { eval: evalScript };
    const queue = { client: Promise.resolve(redis) } as unknown as Queue;
    const moveToDelayed = jest.fn().mockResolvedValue(undefined);
    const job = { data: payload, moveToDelayed } as unknown as Job<DmJob>;
    return { queue, evalScript, job, moveToDelayed };
  }

  it('reserves a slot atomically for the Instagram account', async () => {
    const { queue, evalScript, job, moveToDelayed } = setup(0);

    await expect(reserveCommentPrivateReply(queue, job, 'lock-token')).resolves.toBeUndefined();

    expect(evalScript).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'heylaunch:meta:private-replies:account-1',
      700,
      60 * 60 * 1000,
      expect.any(String),
    );
    expect(moveToDelayed).not.toHaveBeenCalled();
  });

  it('defers a job until a rolling-window slot is available without retrying it', async () => {
    const { queue, job, moveToDelayed } = setup(15_000);

    await expect(reserveCommentPrivateReply(queue, job, 'lock-token')).rejects.toBeInstanceOf(DelayedError);

    expect(moveToDelayed).toHaveBeenCalledWith(expect.any(Number), 'lock-token');
  });

  it('fails closed if it cannot defer a locked job safely', async () => {
    const { queue, job, moveToDelayed } = setup(15_000);

    await expect(reserveCommentPrivateReply(queue, job)).rejects.toThrow('without its BullMQ lock token');

    expect(moveToDelayed).not.toHaveBeenCalled();
  });
});
