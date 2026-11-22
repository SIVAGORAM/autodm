import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLAN_DAYS, PLANS, TIER_ORDER } from './plan.config';

describe('public marketing plan cards', () => {
  const landingPage = readFileSync(resolve(__dirname, '../../../frontend/app/page.tsx'), 'utf8');
  const planArray = landingPage.match(/const plans = \[([\s\S]*?)\n\];/);
  const cards = [...(planArray?.[1] ?? '').matchAll(
    /name:\s*'([^']+)',\s*price:\s*'([^']+)',\s*cadence:\s*'([^']*)',[\s\S]*?features:\s*\[([\s\S]*?)\]/g,
  )];

  it('keeps price, account cap, and monthly DM quota aligned with backend entitlements', () => {
    expect(planArray).not.toBeNull();
    expect(cards).toHaveLength(TIER_ORDER.length);

    for (const tier of TIER_ORDER) {
      const plan = PLANS[tier];
      const card = cards.find((candidate) => candidate[1] === plan.name);
      expect(card).toBeDefined();
      expect(card?.[2]).toBe(plan.priceLabel);
      expect(card?.[4]).toContain(`${plan.accountCap} Instagram account`);
      expect(card?.[4]).toContain(`${plan.dmQuota.toLocaleString('en-IN')} DMs / month`);
      expect(card?.[4]).toContain(plan.features.keywordsPerAutomation >= 9999
        ? 'Unlimited keywords'
        : `${plan.features.keywordsPerAutomation} keyword${plan.features.keywordsPerAutomation === 1 ? '' : 's'} per automation`);
    }
  });

  it('describes paid access as a one-time term with no automatic renewal', () => {
    expect(landingPage).toContain(`/ ${PLAN_DAYS} days`);
    expect(landingPage).toMatch(/does not renew automatically/i);
  });

  it('does not advertise unverified messaging triggers as plan features', () => {
    const planFeatureCopy = cards.map((card) => card[4]).join(' ');
    expect(planFeatureCopy).not.toMatch(/story replies|incoming DMs/i);
  });

  it('does not advertise plan features that are disabled or not implemented in the billing catalogue', () => {
    for (const plan of Object.values(PLANS)) {
      const highlights = plan.highlights.join(' ');
      if (!plan.features.removeBranding) expect(highlights).not.toMatch(/branding removed/i);
      if (!plan.features.clientWorkspaces) expect(highlights).not.toMatch(/workspaces/i);
      if (!plan.features.teamSeats) expect(highlights).not.toMatch(/team seats|invite teammates/i);
      if (!plan.features.leadCollection) expect(highlights).not.toMatch(/lead export|crm/i);
      if (!plan.features.askToFollow) expect(highlights).not.toMatch(/follow gating|follow gate/i);
      if (!plan.features.collectEmail) expect(highlights).not.toMatch(/email capture/i);
    }
  });
});
