import { matchComment, keywordHit, normalize } from './matcher';

describe('normalize', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalize('  Send   LINK  ')).toBe('send link');
  });

  it('preserves emojis while stripping standard punctuation', () => {
    expect(normalize('GUIDE!! 🔥')).toBe('guide 🔥');
    expect(normalize('🚀🚀 YES PLEASE!!!')).toBe('🚀🚀 yes please');
  });

  it('preserves Indic Telugu characters and combining matras', () => {
    // లింక్ (link) in Telugu contains combining vowel mark and virama
    const telugu = 'నాకు లింక్ పంపండి!!';
    expect(normalize(telugu)).toBe('నాకు లింక్ పంపండి');
  });

  it('preserves Indic Hindi / Devanagari characters and combining marks', () => {
    const hindi = 'नमस्ते! मुझे ई-बुक चाहिए।';
    expect(normalize(hindi)).toBe('नमस्ते मुझे ई बुक चाहिए');
  });
});

describe('keywordHit', () => {
  it('matches whole words only in WHOLE_WORD mode', () => {
    expect(keywordHit('please send guide', 'guide')).toBe(true);
    expect(keywordHit('startup life', 'art')).toBe(false);
    expect(keywordHit('GUIDE', 'guide')).toBe(true);
    expect(keywordHit('i want the guide!!', 'guide')).toBe(true);
  });

  it('handles multi-word keywords', () => {
    expect(keywordHit('drop the free guide', 'free guide')).toBe(true);
  });

  it('matches emojis as keywords', () => {
    expect(keywordHit('Love this! 🔥', '🔥')).toBe(true);
    expect(keywordHit('Awesome content 🚀', '🚀')).toBe(true);
  });

  it('supports EXACT match mode and quoted syntax', () => {
    expect(keywordHit('guide', 'guide', 'EXACT')).toBe(true);
    expect(keywordHit('send guide please', 'guide', 'EXACT')).toBe(false);
    expect(keywordHit('yes', '"yes"')).toBe(true);
    expect(keywordHit('yes please', '"yes"')).toBe(false);
    expect(keywordHit('info', '[info]')).toBe(true);
  });

  it('supports CONTAINS match mode and wildcard syntax', () => {
    expect(keywordHit('check out my ebooknow', 'ebook', 'CONTAINS')).toBe(true);
    expect(keywordHit('check out my ebooknow', '*ebook*')).toBe(true);
    expect(keywordHit('check out my ebooknow', 'ebook', 'WHOLE_WORD')).toBe(false);
  });

  it('matches Indic scripts correctly', () => {
    expect(keywordHit('నాకు లింక్ కావాలి', 'లింక్')).toBe(true);
    expect(keywordHit('मुझे पुस्तक भेजो', 'पुस्तक')).toBe(true);
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

  it('filters out comments matching excluded negative keywords', () => {
    const r1 = matchComment({
      text: 'send me guide but this is fake scam',
      matchMode: 'KEYWORDS',
      keywords: ['guide', '-scam', '-fake'],
    });
    expect(r1.matched).toBe(false);
    expect(r1.excludedBy).toBe('scam');

    const r2 = matchComment({
      text: 'send me guide',
      matchMode: 'KEYWORDS',
      keywords: ['guide', 'exclude:spam'],
    });
    expect(r2.matched).toBe(true);
    expect(r2.keyword).toBe('guide');

    const r3 = matchComment({
      text: 'send me guide but stop spamming',
      matchMode: 'KEYWORDS',
      keywords: ['guide'],
      excludedKeywords: ['spam'],
    });
    expect(r3.matched).toBe(false);
    expect(r3.excludedBy).toBe('spam');
  });

  it('supports emoji triggers', () => {
    const r = matchComment({ text: 'Count me in! 🔥', matchMode: 'KEYWORDS', keywords: ['🔥'] });
    expect(r.matched).toBe(true);
    expect(r.keyword).toBe('🔥');
  });

  it('supports Indic Telugu keyword match', () => {
    const r = matchComment({ text: 'సార్ నాకు లింక్ పంపండి', matchMode: 'KEYWORDS', keywords: ['లింక్'] });
    expect(r.matched).toBe(true);
    expect(r.keyword).toBe('లింక్');
  });

  it('legacy AI_INTENT mode does not match semantically without an AI service', () => {
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
