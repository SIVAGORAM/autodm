// Pure matching logic — decides whether an incoming comment/message text
// should fire an automation. No I/O, so it is unit-tested directly.

export type MatchMode = 'KEYWORDS' | 'ANY' | 'AI_INTENT';

export interface MatchInput {
  text: string;
  matchMode: MatchMode;
  keywords: string[];
}

// Normalise: lowercase, trim, collapse whitespace, strip most emoji/punct
// to spaces so "GUIDE!!" and "guide" match.
export function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Whole-word keyword match (so "art" does not match "start").
export function keywordHit(text: string, keyword: string): boolean {
  const normText = normalize(text);
  const normKw = normalize(keyword);
  if (!normKw) return false;
  const pattern = new RegExp(`(^| )${escapeRegex(normKw)}( |$)`);
  return pattern.test(normText);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface MatchResult {
  matched: boolean;
  keyword?: string;
  needsAi?: boolean; // caller should run the LLM intent check
}

export function matchComment(input: MatchInput): MatchResult {
  const { text, matchMode, keywords } = input;
  if (matchMode === 'ANY') return { matched: true };
  if (matchMode === 'AI_INTENT') {
    // A literal keyword still short-circuits; otherwise defer to the LLM.
    for (const kw of keywords) if (keywordHit(text, kw)) return { matched: true, keyword: kw };
    return { matched: false, needsAi: true };
  }
  // KEYWORDS
  for (const kw of keywords) if (keywordHit(text, kw)) return { matched: true, keyword: kw };
  return { matched: false };
}
