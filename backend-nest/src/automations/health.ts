// Pure health computation for an automation. No I/O — unit-tested.
export type HealthLevel = 'healthy' | 'at_risk' | 'needs_reconnect' | 'paused' | 'draft';

export interface HealthInput {
  status: 'DRAFT' | 'LIVE' | 'PAUSED';
  tokenExpiresAt: Date | null;
  recentFailures: number; // FAILED or delivery-unknown runs in the last 24h
  planRestriction?: string | null;
  webhookSubscriptionMissing?: boolean;
  deliveryWorkerUnavailable?: boolean;
  now?: Date;
}
export interface Health { level: HealthLevel; label: string; reason: string; }

const DAY = 86_400_000;

export function computeHealth(i: HealthInput): Health {
  const now = i.now ?? new Date();
  if (i.status === 'DRAFT') return { level: 'draft', label: 'Draft', reason: 'Not live yet.' };
  if (i.status === 'PAUSED') return { level: 'paused', label: 'Paused', reason: 'You paused this automation.' };

  if (i.tokenExpiresAt) {
    const ms = i.tokenExpiresAt.getTime() - now.getTime();
    if (ms <= 0) return { level: 'needs_reconnect', label: 'Needs reconnect', reason: 'Instagram connection expired — reconnect to resume.' };
    if (ms <= 3 * DAY) return { level: 'at_risk', label: 'At risk', reason: 'Instagram connection expires soon.' };
  }
  if (i.planRestriction) return { level: 'at_risk', label: 'Plan limited', reason: i.planRestriction };
  if (i.webhookSubscriptionMissing) {
    return { level: 'at_risk', label: 'Webhooks needed', reason: 'Instagram comment and message events are not connected. Set up webhooks from the Instagram account page to resume.' };
  }
  if (i.deliveryWorkerUnavailable) {
    return { level: 'at_risk', label: 'Delivery offline', reason: 'The delivery worker is not running. Events may queue, but messages will not be processed until delivery resumes.' };
  }
  if (i.recentFailures >= 3) return { level: 'at_risk', label: 'At risk', reason: 'Recent sends are failing.' };
  return { level: 'healthy', label: 'Healthy', reason: 'Firing normally.' };
}
