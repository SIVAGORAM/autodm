import { matchComment, keywordHit, normalize } from './matcher';

describe('normalize', () => {
  it('lowercases and strips punctuation/emoji', () => {
    expect(normalize('GUIDE!! 🔥')).toBe('guide');
    expect(normalize('  Send   LINK  ')).toBe('send link');
  });
});

describe('keywordHit', () => {
  it('matches whole words only', () => {
    expect(keywordHit('please send guide', 'guide')).toBe(true);
    expect(keywordHit('startup life', 'art')).toBe(false);
    expect(keywordHit('GUIDE', 'guide')).toBe(true);
    expect(keywordHit('i want the guide!!', 'guide')).toBe(true);
  });
  it('handles multi-word keywords', () => {
    expect(keywordHit('drop the free guide', 'free guide')).toBe(true);
  });
});

describe('matchComment', () => {
  it('KEYWORDS mode matches a listed keyword', () => {
    const r = matchComment({ text: 'send me GUIDE', matchMode: 'KEYWORDS', keywords: ['guide', 'link'] });
    expect(r.matched).toBe(true);
    expect(r.keyword).toBe('guide');
  });
  it('KEYWORDS mode misses when no keyword present', () => {
    const r = matchComment({ text: 'nice post', matchMode: 'KEYWORDS', keywords: ['guide'] });
    expect(r.matched).toBe(false);
  });
  it('ANY mode always matches', () => {
    expect(matchComment({ text: 'whatever', matchMode: 'ANY', keywords: [] }).matched).toBe(true);
  });
  it('AI_INTENT defers to LLM when no keyword hit', () => {
    const r = matchComment({ text: 'how much is it', matchMode: 'AI_INTENT', keywords: ['price'] });
    expect(r.matched).toBe(false);
    expect(r.needsAi).toBe(true);
  });
  it('AI_INTENT short-circuits on a literal keyword', () => {
    const r = matchComment({ text: 'the price please', matchMode: 'AI_INTENT', keywords: ['price'] });
    expect(r.matched).toBe(true);
    expect(r.needsAi).toBeUndefined();
  });
});
