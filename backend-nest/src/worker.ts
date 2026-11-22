import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Queue } from 'bullmq';
import { AppModule } from './app.module';
import { DmProcessorService } from './queue/dm-processor.service';
import { DM_QUEUE, DmJob } from './queue/queue.constants';
import { createRedis } from './queue/redis';
import { TokenRefreshService } from './instagram/token-refresh.service';
import { WebhookService } from './webhook/webhook.service';
import { safeErrorLabel } from './common/safe-error-label';
import { UsersService } from './users/users.service';
import { MailOutboxService } from './mail/mail-outbox.service';
import { WORKER_HEARTBEAT_INTERVAL_MS, WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_TTL_SECONDS } from './queue/worker-health';
import { areScheduledJobsEnabled } from './common/scheduled-jobs';
import { isDeliveryWorkerEnabledInEnvironment, isMailOutboxWorkerEnabledInEnvironment } from './queue/worker-startup-policy';

// Standalone context: no HTTP server, just DI + the BullMQ worker loop.
async function bootstrap() {
  const log = new Logger('Worker');
  const appCtx = await NestFactory.createApplicationContext(AppModule);
  const processor = appCtx.get(DmProcessorService, { strict: false });
  const webhookProcessor = appCtx.get(WebhookService, { strict: false });
  const users = appCtx.get(UsersService, { strict: false });
  const mailOutbox = appCtx.get(MailOutboxService, { strict: false });
  const config = appCtx.get(ConfigService);
  const runtimeEnv = {
    NODE_ENV: config.get<string>('NODE_ENV', 'development'),
    RUN_DELIVERY_WORKER_IN_DEVELOPMENT: config.get<boolean>('RUN_DELIVERY_WORKER_IN_DEVELOPMENT') ? 'true' : 'false',
    RUN_SCHEDULED_JOBS_IN_DEVELOPMENT: config.get<boolean>('RUN_SCHEDULED_JOBS_IN_DEVELOPMENT') ? 'true' : 'false',
    RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT: config.get<boolean>('RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT') ? 'true' : 'false',
  } as NodeJS.ProcessEnv;
  const deliveryEnabled = isDeliveryWorkerEnabledInEnvironment(runtimeEnv);
  const runMaintenanceJobs = areScheduledJobsEnabled(runtimeEnv);
  const mailOutboxEnabled = isMailOutboxWorkerEnabledInEnvironment(runtimeEnv);
  if (!deliveryEnabled && !runMaintenanceJobs && !mailOutboxEnabled) {
    log.warn('Development delivery, mail, and maintenance workers are disabled. Enable only the specific worker needed, with safe development services.');
    await appCtx.close();
    return;
  }

  let worker: Worker | null = null;
  let mailOutboxTimer: NodeJS.Timeout | null = null;
  let activeMailOutboxProcess: Promise<void> | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  if (deliveryEnabled) {
    const connection = createRedis(config.getOrThrow('REDIS_URL'));
    const refreshHeartbeat = async () => {
      await connection.set(WORKER_HEARTBEAT_KEY, String(Date.now()), 'EX', WORKER_HEARTBEAT_TTL_SECONDS);
    };
    void refreshHeartbeat().catch((error) => log.warn(`worker heartbeat unavailable (${safeErrorLabel(error)})`));
    heartbeatTimer = setInterval(() => {
      void refreshHeartbeat().catch((error) => log.warn(`worker heartbeat unavailable (${safeErrorLabel(error)})`));
    }, WORKER_HEARTBEAT_INTERVAL_MS);
    heartbeatTimer.unref();

    worker = new Worker<any>(DM_QUEUE, async (job) => {
    if (job.name === 'process-webhook-event') {
      await webhookProcessor.processEvent(job.data.webhookEventId);
      return;
    }
    await processor.process(job.data as DmJob, job);
    }, { connection, concurrency: 10 });

    worker.on('completed', (job) => log.debug(`job ${job.id} done`));
    worker.on('failed', (job, err) => {
      log.warn(`job ${job?.id} failed (${safeErrorLabel(err)})`);
      if (job?.name === 'send' && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void processor.markDeliveryUnknown(job.data as DmJob, safeErrorLabel(err))
          .catch((markError) => log.error(`could not mark delivery ${job.id} as unknown (${safeErrorLabel(markError)})`));
      }
    });
    log.log('DM worker started (concurrency=10)');
  } else {
    log.warn('Development delivery worker is disabled. Set RUN_DELIVERY_WORKER_IN_DEVELOPMENT=true only for an authorized test account and safe queue.');
  }

  if (mailOutboxEnabled) {
    const processMailOutbox = () => {
      if (activeMailOutboxProcess) return activeMailOutboxProcess;
      activeMailOutboxProcess = mailOutbox.processPending()
        .then((result) => {
          if (result.processed) {
            log.log(`mail outbox: sent=${result.sent} retry=${result.retried} failed=${result.failed} canceled=${result.canceled}`);
          }
        })
        .catch((error) => log.warn(`mail outbox processing failed (${safeErrorLabel(error)})`))
        .finally(() => { activeMailOutboxProcess = null; });
      return activeMailOutboxProcess;
    };
    void processMailOutbox();
    mailOutboxTimer = setInterval(() => { void processMailOutbox(); }, 10_000);
    mailOutboxTimer.unref();
    log.warn('Development mail outbox worker started. It may send real email; use only an isolated database and test SMTP recipients.');
  }

  // Daily maintenance: refresh Instagram tokens before they expire (60-day limit).
  let maintQueue: Queue | null = null;
  let maintenanceWorker: Worker | null = null;
  if (runMaintenanceJobs) {
  const maintenanceConnection = createRedis(config.getOrThrow('REDIS_URL'));
  const tokenRefresh = appCtx.get(TokenRefreshService, { strict: false });
  maintQueue = new Queue('maintenance', { connection: maintenanceConnection });
  await maintQueue.add('refresh-tokens', {}, { repeat: { pattern: '0 3 * * *' }, jobId: 'refresh-tokens' });
  await maintQueue.add('purge-webhook-payloads', {}, { repeat: { pattern: '30 3 * * *' }, jobId: 'purge-webhook-payloads' });
  await maintQueue.add('drain-webhook-events', {}, { repeat: { every: 10_000 }, jobId: 'drain-webhook-events' });
  await maintQueue.add('recover-stale-runs', {}, { repeat: { every: 60_000 }, jobId: 'recover-stale-runs' });
  await maintQueue.add('process-account-deletions', {}, { repeat: { every: 60_000 }, jobId: 'process-account-deletions' });
  await maintQueue.add('process-mail-outbox', {}, { repeat: { every: 10_000 }, jobId: 'process-mail-outbox' });
  await maintQueue.add('purge-mail-outbox', {}, { repeat: { pattern: '45 3 * * *' }, jobId: 'purge-mail-outbox' });
  await maintQueue.add('schedule-expired-unverified-account-deletions', {}, { repeat: { every: 15 * 60_000 }, jobId: 'schedule-expired-unverified-account-deletions' });
  maintenanceWorker = new Worker('maintenance', async (job) => {
    if (job.name === 'process-mail-outbox') {
      const result = await mailOutbox.processPending();
      if (result.processed) {
        log.log(`mail outbox: sent=${result.sent} retry=${result.retried} failed=${result.failed} canceled=${result.canceled}`);
      }
      return;
    }
    if (job.name === 'purge-mail-outbox') {
      const purged = await mailOutbox.purgeTerminal();
      if (purged) log.log(`maintenance: purged ${purged} terminal mail record(s)`);
      return;
    }
    if (job.name === 'drain-webhook-events') {
      const queued = await webhookProcessor.enqueuePending();
      if (queued) log.log(`webhook recovery: enqueued ${queued} pending event(s)`);
      return;
    }
    if (job.name === 'recover-stale-runs') {
      const recovered = await processor.markStalePendingRunsUnknown();
      if (recovered) log.warn(`run recovery: marked ${recovered} stale delivery run(s) unknown`);
      return;
    }
    if (job.name === 'process-account-deletions') {
      const deleted = await users.processPendingAccountDeletions();
      if (deleted) log.log(`maintenance: permanently deleted ${deleted} account(s)`);
      return;
    }
    if (job.name === 'schedule-expired-unverified-account-deletions') {
      const scheduled = await users.scheduleExpiredUnverifiedAccountDeletions();
      if (scheduled) log.log(`maintenance: scheduled deletion for ${scheduled} expired unverified account(s)`);
      return;
    }
    if (job.name === 'purge-webhook-payloads') {
      const purged = await webhookProcessor.purgeExpiredDeadLetterPayloads(config.get<number>('WEBHOOK_PAYLOAD_RETENTION_DAYS', 30));
      if (purged) log.log(`maintenance: purged ${purged} expired webhook payload(s)`);
      return;
    }
    const r = await tokenRefresh.refreshExpiring(7);
    log.log(`maintenance: tokens ${r.refreshed}/${r.checked}`);
  }, { connection: createRedis(config.getOrThrow('REDIS_URL')), concurrency: 1 });
  maintenanceWorker.on('failed', (job, error) => {
    log.warn(`maintenance job ${job?.name ?? 'unknown'} failed (${safeErrorLabel(error)})`);
  });
  maintenanceWorker.on('error', (error) => {
    log.error(`maintenance worker error (${safeErrorLabel(error)})`);
  });
  log.log('Maintenance worker started (token refresh, webhook recovery, mail outbox, account deletion)');
  } else {
    log.log('Development maintenance jobs are disabled; set RUN_SCHEDULED_JOBS_IN_DEVELOPMENT=true only with safe development services.');
  }

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.log(`Received ${signal}; stopping workers gracefully`);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (mailOutboxTimer) clearInterval(mailOutboxTimer);
    process.off('SIGTERM', onSigterm);
    process.off('SIGINT', onSigint);
    try {
      // Stop fetching jobs and wait for active handlers before closing their
      // queues and shared Redis connections. This reduces forced retries in
      // the middle of an Instagram send, where delivery can be ambiguous.
      await Promise.all([worker?.close(), maintenanceWorker?.close(), maintQueue?.close(), activeMailOutboxProcess]);
      await appCtx.close();
      log.log('Worker shutdown complete');
    } catch (error) {
      log.error(`Worker shutdown failed (${safeErrorLabel(error)})`);
      process.exitCode = 1;
    }
  };
  const onSigterm = () => { void shutdown('SIGTERM'); };
  const onSigint = () => { void shutdown('SIGINT'); };
  process.once('SIGTERM', onSigterm);
  process.once('SIGINT', onSigint);
}
bootstrap();
