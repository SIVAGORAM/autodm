// Pure helpers for turning stored dmBlocks into outgoing buttons, and for
// swapping button URLs for click-tracking redirects. No I/O — unit-tested.

export interface RawButton { title: string; url: string; }
export interface TrackedLinkRef { slug: string; targetUrl: string; }

export function extractButtons(dmBlocks: unknown): RawButton[] {
  const blocks = Array.isArray(dmBlocks) ? dmBlocks : [];
  const out: RawButton[] = [];
  for (const b of blocks as any[]) {
    if (b?.type === 'buttons' && Array.isArray(b.buttons)) {
      for (const btn of b.buttons) {
        if (btn?.title && btn?.url) out.push({ title: String(btn.title), url: String(btn.url) });
      }
    }
  }
  return out;
}

// Affiliate links must stay as-typed so commission + app-open keep working
// (recon: Amazon/Flipkart never wrapped).
const NO_WRAP = /(^|\.)(amazon\.|amzn\.|flipkart\.|fkrt\.)/i;
export function isUnwrappable(url: string): boolean {
  try { return NO_WRAP.test(new URL(url).hostname); } catch { return false; }
}

// Swap each button's URL for its tracking redirect when tracking is on and a
// TrackedLink exists for that exact target. Caps at 3 (Instagram limit).
export function applyTracking(
  buttons: RawButton[],
  links: TrackedLinkRef[],
  trackClicks: boolean,
  publicUrl: string,
  contactIgsid?: string,
): RawButton[] {
  const capped = buttons.slice(0, 3);
  if (!trackClicks) return capped;
  const base = publicUrl.replace(/\/+$/, '');
  return capped.map((b) => {
    if (isUnwrappable(b.url)) return b;
    const link = links.find((l) => l.targetUrl === b.url);
    if (!link) return b;
    const q = contactIgsid ? `?c=${encodeURIComponent(contactIgsid)}` : '';
    return { title: b.title, url: `${base}/r/${link.slug}${q}` };
  });
}
