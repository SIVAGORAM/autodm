// Plan resolution — computed from SERVER time on every request. No background
// job, no client trust. The effective tier drives caps, quotas and feature gates.
import { Tier, PAID_TIERS, planDef } from './plan.config';

export type PlanUser =
  | { plan: string; planExpiresAt?: Date | null; trialEndsAt?: Date | null }
  | null
  | undefined;

export function trialActive(u: PlanUser): boolean {
  return !!(u && u.trialEndsAt && u.trialEndsAt.getTime() > Date.now());
}

// The paid tier the user currently holds (not expired), or null.
// 'PAID' is a legacy value from the old binary model — treated as PRO.
export function paidTier(u: PlanUser): Tier | null {
  if (!u) return null;
  const notExpired = !u.planExpiresAt || u.planExpiresAt.getTime() > Date.now();
  if (!notExpired) return null;
  if (u.plan === 'PAID') return 'PRO'; // legacy alias
  if ((PAID_TIERS as string[]).includes(u.plan)) return u.plan as Tier;
  return null;
}

export function paidActive(u: PlanUser): boolean {
  return paidTier(u) !== null;
}

// A trial grants full PRO. A paid user gets exactly the tier they bought.
export function effectivePlan(u: PlanUser): Tier {
  const paid = paidTier(u);
  if (paid) return paid;
  if (trialActive(u)) return 'PRO';
  return 'FREE';
}

export function isProActive(u: PlanUser): boolean {
  return effectivePlan(u) !== 'FREE';
}

// Convenience: the resolved plan definition for this user.
export function planFor(u: PlanUser) {
  return planDef(effectivePlan(u));
}
