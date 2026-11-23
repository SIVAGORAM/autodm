import { Job } from 'bullmq';
import { CLICK_TO_DIRECT_AD_MESSAGE_WINDOW_MS, commentPrivateReplyWindowState, dmQueueJobId, messageWindowState, STANDARD_MESSAGE_WINDOW_MS, standardMessageWindowState, COMMENT_PRIVATE_REPLY_WINDOW_MS } from './queue.constants';

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

describe('standardMessageWindowState', () => {
  const now = Date.parse('2026-11-23T12:00:00.000Z');

  it('allows a DM or story reply while the standard response window is open', () => {
    expect(standardMessageWindowState(new Date(now - STANDARD_MESSAGE_WINDOW_MS + 1), now)).toBe('ELIGIBLE');
  });

  it('marks the message expired at the 24-hour boundary', () => {
    expect(standardMessageWindowState(new Date(now - STANDARD_MESSAGE_WINDOW_MS), now)).toBe('EXPIRED');
  });

  it.each([undefined, '', 'not-a-date', now + 6 * 60_000])('fails closed when the message time is missing or invalid (%s)', (messageAt) => {
    expect(standardMessageWindowState(messageAt as any, now)).toBe('UNKNOWN');
  });
});

describe('Click-to-Direct ad message window', () => {
  const now = Date.parse('2026-11-23T12:00:00.000Z');

  it('extends only explicitly marked Click-to-Direct messages to seven days', () => {
    expect(messageWindowState(new Date(now - 6 * 24 * 60 * 60 * 1000), 'CLICK_TO_DIRECT_AD', now)).toBe('ELIGIBLE');
    expect(messageWindowState(new Date(now - STANDARD_MESSAGE_WINDOW_MS - 1), 'STANDARD', now)).toBe('EXPIRED');
  });

  it('expires an ad-started message at the seven-day boundary', () => {
    expect(messageWindowState(new Date(now - CLICK_TO_DIRECT_AD_MESSAGE_WINDOW_MS), 'CLICK_TO_DIRECT_AD', now)).toBe('EXPIRED');
  });

  it.each([undefined, '', 'not-a-date', now + 6 * 60_000])('fails closed for missing or unverifiable ad message times (%s)', (messageAt) => {
    expect(messageWindowState(messageAt as any, 'CLICK_TO_DIRECT_AD', now)).toBe('UNKNOWN');
  });
});

describe('comment private-reply window', () => {
  const now = Date.parse('2026-11-23T12:00:00.000Z');

  it('uses the comment creation timestamp and permits a fresh comment', () => {
    expect(commentPrivateReplyWindowState(new Date(now - 6 * 24 * 60 * 60 * 1000), now)).toBe('ELIGIBLE');
  });

  it('expires at seven days from comment creation', () => {
    expect(commentPrivateReplyWindowState(new Date(now - COMMENT_PRIVATE_REPLY_WINDOW_MS), now)).toBe('EXPIRED');
  });

  it.each([undefined, '', 'not-a-date', now + 6 * 60_000])('fails closed when comment creation time is missing or invalid (%s)', (createdAt) => {
    expect(commentPrivateReplyWindowState(createdAt as any, now)).toBe('UNKNOWN');
  });
});
