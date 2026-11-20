// Single source of truth for plan resolution.
// A user is treated as Pro if they paid (PAID, not expired) OR their 2-day trial is still active.
// Everything is computed from SERVER time on each request — no background job, no client trust.
export type PlanUser = { plan: string; planExpiresAt?: Date | null; trialEndsAt?: Date | null } | null | undefined;

export function trialActive(u: PlanUser): boolean {
  return !!(u && u.trialEndsAt && u.trialEndsAt.getTime() > Date.now());
}
export function paidActive(u: PlanUser): boolean {
  return !!(u && u.plan === 'PAID' && (!u.planExpiresAt || u.planExpiresAt.getTime() > Date.now()));
}
export function isProActive(u: PlanUser): boolean {
  return paidActive(u) || trialActive(u);
}
export function effectivePlan(u: PlanUser): 'FREE' | 'PAID' {
  return isProActive(u) ? 'PAID' : 'FREE';
}
