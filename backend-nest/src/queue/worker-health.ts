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

export function getLocalWorkerHeartbeatTimestamp(): number {
  return localHeartbeatTimestamp;
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
    return isLocalWorkerActive(now);
  }
}

export async function getWorkerHealth(queue: Queue, now = Date.now()) {
  const localActive = isLocalWorkerActive(now);

  let heartbeat: string | null = null;
  let counts = { waiting: 0, active: 0, delayed: 0, failed: 0 };
  let oldestWaitingJobs: any[] = [];
  let earliestDelayedJobs: any[] = [];

  const getHeartbeat = Promise.resolve(queue.client).then((client: any) => client.get(WORKER_HEARTBEAT_KEY));
  const results = await Promise.allSettled([
    getHeartbeat,
    queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
    queue.getWaiting(0, 0),
    queue.getDelayed(0, 0),
  ]);

  if (results[0].status === 'fulfilled') {
    heartbeat = results[0].value;
  } else if (!localActive) {
    // Neither local worker nor Redis heartbeat is available — throw to trigger unavailable status
    throw (results[0] as PromiseRejectedResult).reason;
  }

  if (results[1].status === 'fulfilled') {
    counts = { ...counts, ...(results[1].value as Record<string, number>) };
  }
  if (results[2].status === 'fulfilled') oldestWaitingJobs = results[2].value;
  if (results[3].status === 'fulfilled') earliestDelayedJobs = results[3].value;

  const timestamp = heartbeat === null ? Number.NaN : Number(heartbeat);
  const heartbeatDate = new Date(timestamp);
  const validHeartbeatTimestamp = Number.isFinite(timestamp) && Number.isFinite(heartbeatDate.getTime());
  const heartbeatAgeMs = validHeartbeatTimestamp ? now - timestamp : null;
  const alive = localActive || (heartbeatAgeMs !== null && heartbeatAgeMs >= 0 && heartbeatAgeMs <= WORKER_HEARTBEAT_TTL_SECONDS * 1000);
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
    lastHeartbeatAt: validHeartbeatTimestamp
      ? heartbeatDate.toISOString()
      : (localActive ? new Date(localHeartbeatTimestamp).toISOString() : null),
    heartbeatAgeMs: validHeartbeatTimestamp
      ? heartbeatAgeMs
      : (localActive ? Math.max(0, now - localHeartbeatTimestamp) : null),
    queue: {
      ...counts,
      oldestWaitingAgeMs,
      nextDelayedAt,
      delayedOverdueMs,
    },
  };
}
