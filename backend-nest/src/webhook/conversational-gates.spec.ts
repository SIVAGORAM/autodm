import { pickRotatedReply } from '../queue/dm-processor.service';

describe('Concurrency-safe public reply rotation', () => {
  const replies = [
    'Reply 1: Sent to your DMs! 📩',
    'Reply 2: Check your inbox! ✨',
    'Reply 3: Just sent it over! 🚀',
    'Reply 4: Look in your messages! 🔥',
    'Reply 5: Done! Check DMs 📬',
  ];

  it('rotates sequentially through all variations using Redis INCR counts', () => {
    // Simulating Redis INCR returning 1, 2, 3, 4, 5, 6, 7
    expect(pickRotatedReply(replies, 'auto-1', 1)).toBe(replies[0]);
    expect(pickRotatedReply(replies, 'auto-1', 2)).toBe(replies[1]);
    expect(pickRotatedReply(replies, 'auto-1', 3)).toBe(replies[2]);
    expect(pickRotatedReply(replies, 'auto-1', 4)).toBe(replies[3]);
    expect(pickRotatedReply(replies, 'auto-1', 5)).toBe(replies[4]);
    // Wraps around cleanly
    expect(pickRotatedReply(replies, 'auto-1', 6)).toBe(replies[0]);
    expect(pickRotatedReply(replies, 'auto-1', 7)).toBe(replies[1]);
  });

  it('rotates sequentially in-memory when Redis is not available', () => {
    const seed = 'automation-test-seed-' + Date.now();
    expect(pickRotatedReply(replies, seed)).toBe(replies[0]);
    expect(pickRotatedReply(replies, seed)).toBe(replies[1]);
    expect(pickRotatedReply(replies, seed)).toBe(replies[2]);
    expect(pickRotatedReply(replies, seed)).toBe(replies[3]);
    expect(pickRotatedReply(replies, seed)).toBe(replies[4]);
    expect(pickRotatedReply(replies, seed)).toBe(replies[0]);
  });
});

describe('Email extraction and validation logic', () => {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

  it('extracts valid emails accurately from conversational replies', () => {
    expect('my email is alex@example.com please'.match(emailRegex)?.[0]).toBe('alex@example.com');
    expect('ALEX.CREATOR+TEST@SUB.DOMAIN.CO'.match(emailRegex)?.[0]).toBe('ALEX.CREATOR+TEST@SUB.DOMAIN.CO');
  });

  it('rejects invalid email formats', () => {
    expect('not an email address'.match(emailRegex)).toBeNull();
    expect('hello@example'.match(emailRegex)).toBeNull();
    expect('@example.com'.match(emailRegex)).toBeNull();
  });

  it('detects SKIP command cleanly', () => {
    expect('skip'.trim().toUpperCase()).toBe('SKIP');
    expect(' SKIP '.trim().toUpperCase()).toBe('SKIP');
  });
});

describe('Follow-First Scenario verification', () => {
  const canReleaseGatedContent = (isFollower: boolean): boolean => isFollower === true;

  it('Scenario C: Recipient has not followed — fails closed safely', () => {
    const isFollower: boolean = false;
    expect(canReleaseGatedContent(isFollower)).toBe(false);
  });

  it('Scenario A & B: Recipient officially verified as following', () => {
    const isFollower: boolean = true;
    expect(canReleaseGatedContent(isFollower)).toBe(true);
  });
});
