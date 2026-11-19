// Pure health computation for an automation. No I/O — unit-tested.
export type HealthLevel = 'healthy' | 'at_risk' | 'needs_reconnect' | 'paused' | 'draft';

export interface HealthInput {
  status: 'DRAFT' | 'LIVE' | 'PAUSED';
  tokenExpiresAt: Date | null;
  recentFailures: number; // FAILED runs in the last 24h
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
  if (i.recentFailures >= 3) return { level: 'at_risk', label: 'At risk', reason: 'Recent sends are failing.' };
  return { level: 'healthy', label: 'Healthy', reason: 'Firing normally.' };
}
