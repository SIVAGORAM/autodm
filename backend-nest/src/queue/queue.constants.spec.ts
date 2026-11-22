import { Job } from 'bullmq';
import { dmQueueJobId } from './queue.constants';

describe('BullMQ send job identifiers', () => {
  it('generates deterministic, queue-safe IDs for colon-delimited event keys', () => {
    const eventId = 'comment:instagram-user-1:comment-1:fu:follow-up-1';

    const first = dmQueueJobId(eventId);

    expect(first).toMatch(/^dm-[a-f0-9]{64}$/);
    expect(first).not.toContain(':');
    expect(dmQueueJobId(eventId)).toBe(first);
  });

  it('satisfies the installed BullMQ validator where legacy multi-segment IDs fail', () => {
    const validate = (Job.prototype as any).validateOptions;
    const validateId = (jobId: string) => {
      const opts = { jobId };
      return () => validate.call({ opts, name: 'send' }, { opts, data: {} });
    };

    expect(validateId(dmQueueJobId('event:ig-user:comment:fu:step'))).not.toThrow();
    expect(validateId('comment:ig-user:comment:fu:step')).toThrow('Custom Id cannot contain :');
  });
});
