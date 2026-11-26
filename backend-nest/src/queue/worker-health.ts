import { Queue } from 'bullmq';

export const WORKER_HEARTBEAT_KEY = 'heylaunch:worker:heartbeat';
export const WORKER_HEARTBEAT_INTERVAL_MS = 15_000;
export const WORKER_HEARTBEAT_TTL_SECONDS = 45;

let localHeartbeatTimestamp = 0;
let localWorkerActive = false;

export function recordLocalWorkerHeartbeat(): void {
  localHeartbeatTimestamp = Date.now();
  localWorkerActive = true;
}

export function deactivateLocalWorker(): void {
  localWorkerActive = false;
  localHeartbeatTimestamp = 0;
}

export function isLocalWorkerActive(now = Date.now()): boolean {
  return localWorkerActive && now - localHeartbeatTimestamp <= 60_000;
}

/** Fast worker liveness check for creator-facing automation health. */
export async function hasFreshWorkerHeartbeat(queue: Queue, now = Date.now()): Promise<boolean> {
  if (isLocalWorkerActive(now)) {
    return true;
  }
  try {
    const heartbeat = await (await queue.client).get(WORKER_HEARTBEAT_KEY);
    const timestamp = heartbeat === null ? Number.NaN : Number(heartbeat);
    const ageMs = now - timestamp;
    return Number.isFinite(timestamp)
      && Number.isFinite(new Date(timestamp).getTime())
      && ageMs >= 0
      && ageMs <= WORKER_HEARTBEAT_TTL_SECONDS * 1000;
  } catch {
    return false;
  }
}

export async function getWorkerHealth(queue: Queue, now = Date.now()) {
  const [heartbeat, counts, oldestWaitingJobs, earliestDelayedJobs] = await Promise.all([
    (await queue.client).get(WORKER_HEARTBEAT_KEY),
    queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
    queue.getWaiting(0, 0),
    queue.getDelayed(0, 0),
  ]);
  const timestamp = heartbeat === null ? Number.NaN : Number(heartbeat);
  const heartbeatDate = new Date(timestamp);
  const validHeartbeatTimestamp = Number.isFinite(timestamp) && Number.isFinite(heartbeatDate.getTime());
  const heartbeatAgeMs = validHeartbeatTimestamp ? now - timestamp : null;
  const alive = isLocalWorkerActive(now) || (heartbeatAgeMs !== null && heartbeatAgeMs >= 0 && heartbeatAgeMs <= WORKER_HEARTBEAT_TTL_SECONDS * 1000);
  const oldestWaitingTimestamp = Number(oldestWaitingJobs[0]?.timestamp);
  const oldestWaitingDate = new Date(oldestWaitingTimestamp);
  const validOldestWaitingTimestamp = Number.isFinite(oldestWaitingTimestamp) && Number.isFinite(oldestWaitingDate.getTime());
  const oldestWaitingAgeMs = validOldestWaitingTimestamp
    ? Math.max(0, now - oldestWaitingTimestamp)
    : null;
  const delayedJob = earliestDelayedJobs[0];
  const delayedDueAtMs = delayedJob ? Number(delayedJob.timestamp) + Number(delayedJob.delay) : Number.NaN;
  const delayedDueDate = new Date(delayedDueAtMs);
  const validDelayedDueAt = Number.isFinite(delayedDueAtMs) && Number.isFinite(delayedDueDate.getTime());
  const nextDelayedAt = validDelayedDueAt ? delayedDueDate.toISOString() : null;
  const delayedOverdueMs = validDelayedDueAt ? Math.max(0, now - delayedDueAtMs) : null;

  return {
    status: alive ? 'ok' : 'stale',
    lastHeartbeatAt: validHeartbeatTimestamp ? heartbeatDate.toISOString() : null,
    heartbeatAgeMs,
    queue: {
      ...counts,
      oldestWaitingAgeMs,
      nextDelayedAt,
      delayedOverdueMs,
    },
  };
}
