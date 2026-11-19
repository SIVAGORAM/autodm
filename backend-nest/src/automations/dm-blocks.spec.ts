import { extractButtons, applyTracking, isUnwrappable } from './dm-blocks';

const blocks = [
  { type: 'text', text: 'hi' },
  { type: 'buttons', buttons: [{ title: 'Get it', url: 'https://shop.me/x' }, { title: 'Amazon', url: 'https://www.amazon.in/dp/abc' }] },
];
const links = [{ slug: 'ab12', targetUrl: 'https://shop.me/x' }];

describe('extractButtons', () => {
  it('pulls title+url pairs from button blocks', () => {
    expect(extractButtons(blocks)).toEqual([
      { title: 'Get it', url: 'https://shop.me/x' },
      { title: 'Amazon', url: 'https://www.amazon.in/dp/abc' },
    ]);
  });
  it('ignores malformed input', () => {
    expect(extractButtons(null)).toEqual([]);
    expect(extractButtons([{ type: 'buttons', buttons: [{ title: 'x' }] }])).toEqual([]);
  });
});

describe('isUnwrappable', () => {
  it('flags Amazon/Flipkart', () => {
    expect(isUnwrappable('https://www.amazon.in/dp/x')).toBe(true);
    expect(isUnwrappable('https://dl.flipkart.com/y')).toBe(true);
    expect(isUnwrappable('https://shop.me/x')).toBe(false);
  });
});

describe('applyTracking', () => {
  it('wraps a tracked URL in the redirect', () => {
    const out = applyTracking(extractButtons(blocks), links, true, 'https://api.me/', 'IGSID1');
    expect(out[0].url).toBe('https://api.me/r/ab12?c=IGSID1');
  });
  it('leaves Amazon untouched even when tracking is on', () => {
    const out = applyTracking(extractButtons(blocks), links, true, 'https://api.me');
    expect(out[1].url).toBe('https://www.amazon.in/dp/abc');
  });
  it('returns raw URLs when tracking is off', () => {
    const out = applyTracking(extractButtons(blocks), links, false, 'https://api.me');
    expect(out[0].url).toBe('https://shop.me/x');
  });
  it('leaves a button whose URL has no tracked link', () => {
    const out = applyTracking([{ title: 'z', url: 'https://other.me/z' }], links, true, 'https://api.me');
    expect(out[0].url).toBe('https://other.me/z');
  });
});
