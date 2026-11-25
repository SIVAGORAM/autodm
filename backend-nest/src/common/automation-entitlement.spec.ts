import { automationRestriction } from './automation-entitlement';
import { PLANS } from './plan.config';
import { accountPlanRestriction } from './plan.util';

describe('automation plan entitlements', () => {
  it('does not advertise a branding-removal entitlement that has no implementation', () => {
    expect(Object.values(PLANS).every((plan) => !plan.features.removeBranding)).toBe(true);
  });

  it('allows the free post-comment surface within its keyword limit', () => {
    expect(automationRestriction(PLANS.FREE, {
      triggerType: 'POST_COMMENT', matchMode: 'KEYWORDS', keywords: ['guide'], followUpCount: 0,
    })).toBeNull();
  });

  it('blocks paid triggers, over-limit keywords, and follow-ups after downgrade', () => {
    expect(automationRestriction(PLANS.FREE, { triggerType: 'ANY_POST' })).toMatch(/higher plan/i);
    expect(automationRestriction(PLANS.FREE, { triggerType: 'POST_COMMENT', matchMode: 'KEYWORDS', keywords: ['one', 'two'] })).toMatch(/keyword limit/i);
    expect(automationRestriction(PLANS.FREE, { followUpCount: 1 })).toMatch(/follow-ups/i);
  });

  it('treats legacy comment rules without a post ID as the paid global trigger', () => {
    expect(automationRestriction(PLANS.FREE, { triggerType: 'POST_COMMENT', mediaId: null })).toMatch(/higher plan/i);
    expect(automationRestriction(PLANS.CREATOR, { triggerType: 'POST_COMMENT', mediaId: null })).toBeNull();
  });

  it('continues the primary trigger when only follow-up entitlement is missing', () => {
    expect(automationRestriction(PLANS.FREE, { triggerType: 'POST_COMMENT', followUpCount: 1 }, { includeFollowUps: false })).toBeNull();
  });

  it('rejects unsupported automation modes independent of plan', () => {
    expect(automationRestriction(PLANS.PRO, { triggerType: 'POST_COMMENT', matchMode: 'AI_INTENT' })).toMatch(/not available/i);
    expect(automationRestriction(PLANS.PRO, { triggerType: 'NEXT_POST' })).toMatch(/not available/i);
  });

  it('allows follow gating and email collection when supported by plan', () => {
    expect(automationRestriction(PLANS.PRO, { triggerType: 'POST_COMMENT', askToFollow: true })).toBeNull();
    expect(automationRestriction(PLANS.PRO, { triggerType: 'POST_COMMENT', collectEmail: true })).toBeNull();
  });
});

describe('connected account plan slots', () => {
  it('keeps the oldest account slots and explains the over-cap account', () => {
    expect(accountPlanRestriction(PLANS.FREE, ['old-account', 'new-account'], 'old-account')).toBeNull();
    expect(accountPlanRestriction(PLANS.FREE, ['old-account', 'new-account'], 'new-account')).toMatch(/disconnect an account/i);
  });
});
