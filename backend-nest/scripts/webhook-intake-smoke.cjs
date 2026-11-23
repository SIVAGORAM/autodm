const assert = require('node:assert/strict');
const { createHash, createHmac, randomUUID } = require('node:crypto');
const { QueueEvents, Worker } = require('bullmq');
const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { AppModule } = require('../dist/app.module.js');
const { PrismaService } = require('../dist/prisma/prisma.service.js');
const { EncryptionService } = require('../dist/common/encryption.service.js');
const { MetaService } = require('../dist/meta/meta.service.js');
const { InstagramService } = require('../dist/instagram/instagram.service.js');
const { WebhookService } = require('../dist/webhook/webhook.service.js');
const { DmProcessorService } = require('../dist/queue/dm-processor.service.js');
const { DM_QUEUE, DM_QUEUE_TOKEN, dmQueueJobId } = require('../dist/queue/queue.constants.js');
const { processDmQueueJob } = require('../dist/queue/worker-job-handler.js');
const { createRedis } = require('../dist/queue/redis.js');

const baseUrl = new URL(process.env.API_SMOKE_BASE_URL || 'http://127.0.0.1:4000');
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '::1'].includes(baseUrl.hostname)) {
  throw new Error('Webhook intake smoke test is restricted to a loopback API with NODE_ENV=test.');
}

function requireLoopbackService(name) {
  let target;
  try { target = new URL(process.env[name]); } catch {
    throw new Error(`Webhook intake smoke test requires ${name} to point to a loopback service.`);
  }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(target.hostname)) {
    throw new Error(`Webhook intake smoke test refuses non-loopback ${name} targets.`);
  }
}

requireLoopbackService('DATABASE_URL');
if (process.env.DIRECT_URL) requireLoopbackService('DIRECT_URL');
requireLoopbackService('REDIS_URL');
if (!process.env.META_APP_SECRET) throw new Error('META_APP_SECRET must be set to a CI-only test value.');

const nonce = randomUUID();
const email = `webhook-smoke-${nonce}@example.invalid`;
const igUserId = `178414${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
const senderId = `178400${Date.now()}${Math.floor(Math.random() * 1_000_000)}`;
const commentId = `webhook-smoke-${nonce}`;
const mediaId = `webhook-smoke-media-${nonce}`;
const eventId = `comment:${igUserId}:${commentId}`;
const storyReplyMid = `webhook-smoke-story-${nonce}`;
const directMessageMid = `webhook-smoke-dm-${nonce}`;
const commentReplyNewestMid = `webhook-smoke-comment-reply-newer-${nonce}`;
const commentReplyOlderMid = `webhook-smoke-comment-reply-older-${nonce}`;
const storyReplyEventId = `message:${igUserId}:${storyReplyMid}`;
const directMessageEventId = `message:${igUserId}:${directMessageMid}`;
const commentReplyNewestEventId = `message:${igUserId}:${commentReplyNewestMid}`;
const commentReplyOlderEventId = `message:${igUserId}:${commentReplyOlderMid}`;
const eventIds = [eventId, storyReplyEventId, directMessageEventId, commentReplyNewestEventId, commentReplyOlderEventId];
const webhookQueueJobIds = eventIds.map((id) => `wh-${createHash('sha256').update(id).digest('hex')}`);
const sendQueueJobId = dmQueueJobId(eventId);
const storyReplySendJobId = dmQueueJobId(storyReplyEventId);
const directMessageSendJobId = dmQueueJobId(directMessageEventId);
const sendQueueJobIds = [sendQueueJobId, storyReplySendJobId, directMessageSendJobId];
const privateReplyLimitKey = `heylaunch:meta:private-replies:`;
let userId;
let appContext;
let prisma;
let queue;
let webhookProcessor;
let dmProcessor;
let meta;
let instagram;
let instagramAccountId;
let worker;
let queueEvents;
let workerConnection;

function signature(body) {
  return `sha256=${createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex')}`;
}

async function send(body, sig = signature(body)) {
  return fetch(new URL('/webhooks/instagram', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig },
    body,
    signal: AbortSignal.timeout(10_000),
  });
}

async function main() {
  appContext = await NestFactory.createApplicationContext(AppModule, { logger: false });
  prisma = appContext.get(PrismaService);
  queue = appContext.get(DM_QUEUE_TOKEN);
  webhookProcessor = appContext.get(WebhookService);
  dmProcessor = appContext.get(DmProcessorService);
  meta = appContext.get(MetaService);
  instagram = appContext.get(InstagramService);
  assert.equal(await (await queue.client).ping(), 'PONG', 'Redis did not answer PING.');
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'unused-ci-smoke-password-hash',
      name: 'Webhook intake smoke',
      isVerified: true,
      plan: 'PRO',
      planExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  userId = user.id;
  const encryption = appContext.get(EncryptionService);
  const instagramAccount = await prisma.igAccount.create({
    data: {
      userId,
      igUserId,
      username: 'webhook_smoke',
      accessTokenEnc: encryption.encrypt('ci-only-instagram-token'),
      webhookSubscribedAt: new Date(),
    },
    select: { id: true },
  });
  instagramAccountId = instagramAccount.id;
  const automation = await prisma.automation.create({
    data: {
      igAccount: { connect: { igUserId } },
      name: 'Webhook intake smoke',
      triggerType: 'POST_COMMENT',
      mediaId,
      matchMode: 'KEYWORDS',
      keywords: ['hello'],
      dmBlocks: [{ type: 'text', text: 'CI pipeline response' }],
      status: 'LIVE',
      dailyLimit: 20,
      followUps: {
        create: [{
          order: 0,
          condition: 'DELAY',
          delayMinutes: 10,
          dmBlocks: [{ type: 'text', text: 'CI comment follow-up' }],
        }],
      },
    },
    select: { id: true, followUps: { select: { id: true } } },
  });
  assert.equal(automation.followUps.length, 1, 'The comment automation fixture did not create its delayed follow-up.');
  const followUpEventId = `${eventId}:fu:${automation.followUps[0].id}`;
  const followUpSendJobId = dmQueueJobId(followUpEventId);
  sendQueueJobIds.push(followUpSendJobId);

  // The worker uses these same providers, but CI substitutes deterministic
  // responses so no Meta request or customer-facing message can occur.
  instagram.getCommentMetadata = async () => ({ mediaId, createdAt: new Date().toISOString() });
  const providerSends = [];
  meta.sendCommentDm = async (...args) => {
    providerSends.push({ kind: 'comment', args });
    return { ok: true, data: { id: 'ci-stub-message-id' } };
  };
  meta.sendDirectMessage = async (...args) => {
    providerSends.push({ kind: 'direct', args });
    return { ok: true, data: { id: `ci-stub-message-${providerSends.length}` } };
  };

  const payload = JSON.stringify({
    object: 'instagram',
    entry: [{
      id: igUserId,
      time: Math.floor(Date.now() / 1000),
      changes: [{
        field: 'comments',
        value: {
          id: commentId,
          text: 'hello from the webhook pipeline smoke test',
          from: { id: senderId, username: 'webhook_smoke_viewer' },
          media: { id: mediaId },
        },
      }],
    }],
  });

  const rejected = await send(payload, 'sha256=invalid');
  assert.equal(rejected.status, 401, 'A webhook with a bad signature was not rejected.');
  assert.equal(await prisma.webhookEvent.count({ where: { eventId } }), 0,
    'A webhook with a bad signature created a durable event.');

  const accepted = await send(payload);
  assert.equal(accepted.status, 200, `Signed webhook was not accepted (HTTP ${accepted.status}).`);
  assert.equal(await accepted.text(), 'EVENT_RECEIVED');

  const receipt = await prisma.webhookEvent.findUnique({ where: { eventId } });
  assert.ok(receipt, 'Signed webhook was not persisted before acknowledgment.');
  assert.equal(receipt.igUserId, igUserId);
  assert.equal(receipt.processedAt, null, 'The API process unexpectedly consumed a worker job.');
  assert.ok(receipt.payload, 'Pending webhook recovery payload was not retained.');

  const processJob = await queue.getJob(webhookQueueJobIds[0]);
  assert.ok(processJob, 'No durable processing job was queued for the persisted receipt.');
  assert.equal(processJob.name, 'process-webhook-event');
  assert.equal(processJob.data.webhookEventId, receipt.id);
  assert.equal(processJob.opts.attempts, 1, 'The queue job bypasses the database-owned retry schedule.');

  const queuedBeforeWorker = await queue.getJobs(['waiting', 'delayed', 'active']);
  assert.deepEqual(queuedBeforeWorker.map((job) => job.id), [webhookQueueJobIds[0]],
    'The isolated Redis queue contains jobs outside this smoke test; refusing to start a worker.');

  // Exercise the same BullMQ worker loop and dispatch function used in
  // production. CI uses ephemeral loopback services and the Meta adapter is
  // stubbed above, so this cannot send a real message.
  const config = appContext.get(ConfigService);
  workerConnection = createRedis(config.getOrThrow('REDIS_URL'));
  queueEvents = new QueueEvents(DM_QUEUE, { connection: createRedis(config.getOrThrow('REDIS_URL')) });
  worker = new Worker(DM_QUEUE, (job) => processDmQueueJob(job, webhookProcessor, dmProcessor), {
    connection: workerConnection,
    concurrency: 1,
  });
  worker.on('error', () => undefined);
  await Promise.all([worker.waitUntilReady(), queueEvents.waitUntilReady()]);
  await processJob.waitUntilFinished(queueEvents, 10_000);

  const processedReceipt = await prisma.webhookEvent.findUnique({ where: { eventId } });
  assert.ok(processedReceipt.processedAt, 'The webhook processor did not complete the valid inbound event.');
  const contact = await prisma.contact.findUnique({
    where: { igAccountId_igScopedId: { igAccountId: instagramAccount.id, igScopedId: senderId } },
  });
  assert.ok(contact, 'The matched comment author did not resolve to an Instagram contact.');
  const reservation = await prisma.dmQuotaReservation.findUnique({ where: { triggerEventId: eventId } });
  assert.ok(reservation, 'The matching automation did not reserve its DM quota.');
  assert.equal(reservation.status, 'RESERVED');

  const sendJob = await queue.getJob(sendQueueJobId);
  assert.ok(sendJob, 'The matched automation did not queue its outbound send job.');
  assert.equal(sendJob.name, 'send');
  assert.equal(sendJob.data.automationId, automation.id);
  assert.equal(sendJob.data.text, 'CI pipeline response');
  assert.equal(sendJob.data.recipientIgsid, senderId);
  assert.equal(sendJob.data.triggerEventId, eventId);

  await sendJob.waitUntilFinished(queueEvents, 10_000);
  assert.deepEqual(providerSends.find((item) => item.kind === 'comment')?.args,
    [igUserId, 'ci-only-instagram-token', commentId, 'CI pipeline response', [], 'INSTAGRAM_LOGIN'],
    'The worker processor did not invoke the stubbed private-reply provider with the matched job data.');
  const deliveryRun = await prisma.run.findUnique({ where: { triggerEventId: eventId } });
  assert.equal(deliveryRun.status, 'SENT', 'A successful stubbed private reply did not mark its run as sent.');
  assert.equal(deliveryRun.contactId ? true : false, true, 'The delivery run is not linked to its Instagram contact.');
  const settledReservation = await prisma.dmQuotaReservation.findUnique({ where: { triggerEventId: eventId } });
  assert.equal(settledReservation.status, 'CONSUMED', 'A successful delivery did not settle the DM quota reservation.');
  const deliveredContact = await prisma.contact.findUnique({
    where: { igAccountId_igScopedId: { igAccountId: instagramAccount.id, igScopedId: senderId } },
  });
  assert.equal(deliveredContact.dmsSent, 1, 'The delivered DM count was not updated.');

  const storyAutomation = await prisma.automation.create({
    data: {
      igAccount: { connect: { igUserId } },
      name: 'Story reply pipeline smoke',
      triggerType: 'STORY_REPLY',
      matchMode: 'KEYWORDS',
      keywords: ['hello'],
      dmBlocks: [{ type: 'text', text: 'CI story reply response' }],
      status: 'LIVE',
      dailyLimit: 20,
    },
    select: { id: true },
  });
  const directMessageAutomation = await prisma.automation.create({
    data: {
      igAccount: { connect: { igUserId } },
      name: 'Incoming DM pipeline smoke',
      triggerType: 'DM',
      matchMode: 'KEYWORDS',
      keywords: ['hello'],
      dmBlocks: [{ type: 'text', text: 'CI direct message response' }],
      status: 'LIVE',
      dailyLimit: 20,
    },
    select: { id: true },
  });
  const messageTimestamp = Date.now();
  const messagesPayload = JSON.stringify({
    object: 'instagram',
    entry: [{
      id: igUserId,
      time: Math.floor(messageTimestamp / 1000),
      messaging: [
        {
          sender: { id: senderId },
          recipient: { id: igUserId },
          timestamp: messageTimestamp,
          message: {
            mid: storyReplyMid,
            text: 'hello on the story',
            reply_to: { story: { id: `story-${nonce}` } },
          },
        },
        {
          sender: { id: senderId },
          recipient: { id: igUserId },
          timestamp: messageTimestamp + 1,
          message: { mid: directMessageMid, text: 'hello in the inbox' },
        },
      ],
    }],
  });

  const acceptedMessages = await send(messagesPayload);
  assert.equal(acceptedMessages.status, 200, `Signed Story/DM webhook was not accepted (HTTP ${acceptedMessages.status}).`);
  assert.equal(await acceptedMessages.text(), 'EVENT_RECEIVED');
  const messageReceipts = await prisma.webhookEvent.findMany({ where: { eventId: { in: eventIds.slice(1) } } });
  assert.equal(messageReceipts.length, 2, 'Story reply and incoming DM receipts were not durably persisted.');
  const messageReceiptByEventId = new Map(messageReceipts.map((receipt) => [receipt.eventId, receipt]));
  for (const messageEventId of eventIds.slice(1)) {
    const receipt = messageReceiptByEventId.get(messageEventId);
    assert.ok(receipt?.payload, `Webhook payload for ${messageEventId} was not retained.`);
    const queueId = webhookQueueJobIds[eventIds.indexOf(messageEventId)];
    const processJob = await queue.getJob(queueId);
    assert.ok(processJob, `No worker job was queued for ${messageEventId}.`);
    await processJob.waitUntilFinished(queueEvents, 10_000);
  }

  const storySendJob = await queue.getJob(storyReplySendJobId);
  const directMessageSendJob = await queue.getJob(directMessageSendJobId);
  assert.ok(storySendJob, 'Story reply did not match its automation and queue a response.');
  assert.ok(directMessageSendJob, 'Incoming DM did not match its automation and queue a response.');
  assert.equal(storySendJob.data.automationId, storyAutomation.id);
  assert.equal(storySendJob.data.triggerType, 'STORY_REPLY');
  assert.equal(storySendJob.data.text, 'CI story reply response');
  assert.equal(directMessageSendJob.data.automationId, directMessageAutomation.id);
  assert.equal(directMessageSendJob.data.triggerType, 'DM');
  assert.equal(directMessageSendJob.data.text, 'CI direct message response');
  await Promise.all([
    storySendJob.waitUntilFinished(queueEvents, 10_000),
    directMessageSendJob.waitUntilFinished(queueEvents, 10_000),
  ]);

  const directSends = providerSends.filter((item) => item.kind === 'direct');
  assert.equal(directSends.length, 2, 'Story/DM jobs did not invoke the deterministic direct-message stub twice.');
  assert.deepEqual(directSends.map((item) => item.args.slice(0, 4)).sort((a, b) => a[3].localeCompare(b[3])), [
    [igUserId, 'ci-only-instagram-token', senderId, 'CI direct message response'],
    [igUserId, 'ci-only-instagram-token', senderId, 'CI story reply response'],
  ].sort((a, b) => a[3].localeCompare(b[3])));
  for (const messageEventId of eventIds.slice(1)) {
    const run = await prisma.run.findUnique({ where: { triggerEventId: messageEventId } });
    assert.equal(run?.status, 'SENT', `${messageEventId} did not reach a sent delivery state.`);
    const quota = await prisma.dmQuotaReservation.findUnique({ where: { triggerEventId: messageEventId } });
    assert.equal(quota?.status, 'CONSUMED', `${messageEventId} did not settle its quota reservation.`);
  }
  const contactAfterMessages = await prisma.contact.findUnique({
    where: { igAccountId_igScopedId: { igAccountId: instagramAccount.id, igScopedId: senderId } },
  });
  assert.equal(contactAfterMessages.dmsSent, 3, 'Story/DM deliveries were not added to the contact delivery count.');

  // Deliver a newer comment-private-reply response before an older one. Both
  // events must schedule from the monotonic persisted timestamp, so the older
  // event cannot pull the delayed comment follow-up closer to delivery.
  const newestReplyTimestamp = Math.max(Date.now() + 5_000, contactAfterMessages.lastReplyAt.getTime() + 1_000);
  const olderReplyTimestamp = newestReplyTimestamp - 500;
  const outOfOrderReplyPayload = JSON.stringify({
    object: 'instagram',
    entry: [{
      id: igUserId,
      time: Math.floor(newestReplyTimestamp / 1000),
      messaging: [
        {
          sender: { id: senderId },
          recipient: { id: igUserId },
          timestamp: newestReplyTimestamp,
          message: { mid: commentReplyNewestMid, text: 'newer reply to the comment' },
        },
        {
          sender: { id: senderId },
          recipient: { id: igUserId },
          timestamp: olderReplyTimestamp,
          message: { mid: commentReplyOlderMid, text: 'older reply to the comment' },
        },
      ],
    }],
  });
  const acceptedOutOfOrderReplies = await send(outOfOrderReplyPayload);
  assert.equal(acceptedOutOfOrderReplies.status, 200,
    `Signed out-of-order comment replies were not accepted (HTTP ${acceptedOutOfOrderReplies.status}).`);
  assert.equal(await acceptedOutOfOrderReplies.text(), 'EVENT_RECEIVED');
  for (const replyEventId of [commentReplyNewestEventId, commentReplyOlderEventId]) {
    const receipt = await prisma.webhookEvent.findUnique({ where: { eventId: replyEventId } });
    assert.ok(receipt?.payload, `Comment reply receipt ${replyEventId} was not durably persisted.`);
    const jobId = webhookQueueJobIds[eventIds.indexOf(replyEventId)];
    const processReplyJob = await queue.getJob(jobId);
    assert.ok(processReplyJob, `No worker job was queued for comment reply ${replyEventId}.`);
    await processReplyJob.waitUntilFinished(queueEvents, 10_000);
  }
  const latestReplyContact = await prisma.contact.findUnique({
    where: { igAccountId_igScopedId: { igAccountId: instagramAccount.id, igScopedId: senderId } },
  });
  assert.equal(latestReplyContact.lastReplyAt.getTime(), newestReplyTimestamp,
    'An older comment reply moved the persisted reply timestamp backwards.');
  const commentFollowUpJob = await queue.getJob(followUpSendJobId);
  assert.ok(commentFollowUpJob, 'The comment reply did not schedule its follow-up.');
  assert.equal(commentFollowUpJob.data.replyReceivedAt, new Date(newestReplyTimestamp).toISOString(),
    'The delayed comment follow-up was scheduled from an older webhook timestamp.');
  assert.equal(await commentFollowUpJob.getState(), 'delayed',
    'The comment follow-up should remain delayed until its configured reply-relative delay elapses.');

  const duplicate = await send(payload);
  assert.equal(duplicate.status, 200, 'An idempotent provider retry was not acknowledged.');
  assert.equal(await prisma.webhookEvent.count({ where: { eventId } }), 1,
    'A duplicate provider delivery created another receipt.');
  const duplicateSendJob = await queue.getJob(sendQueueJobId);
  assert.ok(duplicateSendJob, 'A duplicate delivery removed the queued outbound job.');
  assert.equal(duplicateSendJob.data.automationId, automation.id);

  console.log('Webhook pipeline smoke passed: bad signature rejected; signed comment, Story reply, and incoming DM persisted and completed through the BullMQ worker against deterministic Meta stubs; comment follow-up uses the newest timestamp after out-of-order replies; quota settled; duplicate delivery was idempotent. No external Meta request was run.');
}

main().catch((error) => {
  console.error(error.message || 'Webhook intake smoke test failed.');
  process.exitCode = 1;
}).finally(async () => {
  await worker?.close().catch(() => undefined);
  await queueEvents?.close().catch(() => undefined);
  await workerConnection?.quit().catch(() => undefined);
  for (const jobId of [...webhookQueueJobIds, ...sendQueueJobIds]) {
    try {
      const job = await queue?.getJob(jobId);
      if (job && await job.getState() !== 'active') await job.remove();
    } catch { /* CI cleanup continues if Redis is unavailable. */ }
  }
  if (queue && instagramAccountId) {
    try { await (await queue.client).del(`${privateReplyLimitKey}${instagramAccountId}`); }
    catch { /* CI cleanup continues if Redis is unavailable. */ }
  }
  if (prisma) {
    try { await prisma.dmQuotaReservation.deleteMany({ where: { triggerEventId: { in: eventIds } } }); }
    catch { /* CI cleanup continues on test failure. */ }
  }
  if (userId && prisma) {
    try { await prisma.user.delete({ where: { id: userId } }); } catch { /* CI cleanup continues on test failure. */ }
  }
  if (appContext) await appContext.close().catch(() => undefined);
});
