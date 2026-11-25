// Pure matching logic — decides whether an incoming comment/message text
// should fire an automation. No I/O, so it is unit-tested directly.

export type MatchMode = 'KEYWORDS' | 'ANY' | 'AI_INTENT';
export type KeywordRule = 'WHOLE_WORD' | 'EXACT' | 'CONTAINS';

export interface MatchInput {
  text: string;
  matchMode: MatchMode;
  keywords: string[];
  excludedKeywords?: string[];
  keywordRule?: KeywordRule;
}

/**
 * Normalise text:
 * - Lowercase
 * - Preserves Unicode letters (\p{L}), Unicode combining marks/matras (\p{M} for Telugu/Hindi/etc.),
 *   Unicode numbers (\p{N}), and emojis (\p{Extended_Pictographic}).
 * - Replaces other punctuation/symbols with spaces.
 * - Collapses repeated whitespace.
 */
export function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}\p{Extended_Pictographic}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if an individual keyword hits the comment text according to the matching rule.
 */
export function keywordHit(text: string, keyword: string, rule: KeywordRule = 'WHOLE_WORD'): boolean {
  let targetRule = rule;
  let rawKw = (keyword || '').trim();

  // Detect syntactic modifiers if present
  // Quotes: "free guide" or [free guide] implies EXACT match
  if ((rawKw.startsWith('"') && rawKw.endsWith('"')) || (rawKw.startsWith('[') && rawKw.endsWith(']'))) {
    targetRule = 'EXACT';
    rawKw = rawKw.slice(1, -1).trim();
  } else if (rawKw.startsWith('*') && rawKw.endsWith('*')) {
    targetRule = 'CONTAINS';
    rawKw = rawKw.slice(1, -1).trim();
  }

  const normText = normalize(text);
  const normKw = normalize(rawKw);
  if (!normKw) return false;

  if (targetRule === 'EXACT') {
    return normText === normKw;
  }

  if (targetRule === 'CONTAINS') {
    return normText.includes(normKw);
  }

  // WHOLE_WORD (default):
  // Check token boundary (^| )kw( |$)
  const pattern = new RegExp(`(^|\\s)${escapeRegex(normKw)}(\\s|$)`, 'u');
  return pattern.test(normText);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface MatchResult {
  matched: boolean;
  keyword?: string;
  excludedBy?: string;
  needsAi?: boolean; // legacy marker; no AI intent service is currently wired
}

export function matchComment(input: MatchInput): MatchResult {
  const { text, matchMode, keywords, excludedKeywords = [], keywordRule = 'WHOLE_WORD' } = input;
  if (!text && matchMode !== 'ANY') return { matched: false };

  // Separate positive keywords from negative/excluded keywords
  const positiveKeywords: string[] = [];
  const allExcluded: string[] = [...excludedKeywords];

  for (const kw of keywords) {
    const trimmed = (kw || '').trim();
    if (trimmed.startsWith('-') && trimmed.length > 1) {
      allExcluded.push(trimmed.slice(1).trim());
    } else if (trimmed.toLowerCase().startsWith('exclude:')) {
      allExcluded.push(trimmed.slice(8).trim());
    } else if (trimmed) {
      positiveKeywords.push(trimmed);
    }
  }

  // 1. Check if comment triggers any excluded keyword (anti-spam / negative keywords)
  for (const ex of allExcluded) {
    const normEx = normalize(ex);
    if (!normEx) continue;
    // An exclusion matches if the text contains that word or phrase
    if (keywordHit(text, normEx, 'WHOLE_WORD') || normalize(text).includes(normEx)) {
      return { matched: false, excludedBy: ex };
    }
  }

  if (matchMode === 'ANY') return { matched: true };

  if (matchMode === 'AI_INTENT') {
    // A literal keyword still short-circuits; otherwise defer to the LLM.
    for (const kw of positiveKeywords) {
      if (keywordHit(text, kw, keywordRule)) return { matched: true, keyword: kw };
    }
    return { matched: false, needsAi: true };
  }

  // KEYWORDS mode
  for (const kw of positiveKeywords) {
    if (keywordHit(text, kw, keywordRule)) {
      return { matched: true, keyword: kw };
    }
  }

  return { matched: false };
}
