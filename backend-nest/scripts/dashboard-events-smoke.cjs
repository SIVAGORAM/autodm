const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const Redis = require('ioredis');

const baseUrl = new URL(process.env.API_SMOKE_BASE_URL || 'http://127.0.0.1:4000');
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '::1'].includes(baseUrl.hostname)) {
  throw new Error('Dashboard event smoke test is restricted to a loopback API with NODE_ENV=test.');
}

function requireLoopbackService(name) {
  let target;
  try { target = new URL(process.env[name]); } catch {
    throw new Error(`Dashboard event smoke test requires ${name} to point to a loopback service.`);
  }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(target.hostname)) {
    throw new Error(`Dashboard event smoke test refuses non-loopback ${name} targets.`);
  }
}

requireLoopbackService('DATABASE_URL');
if (process.env.DIRECT_URL) requireLoopbackService('DIRECT_URL');
requireLoopbackService('REDIS_URL');

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 });
const email = `dashboard-events-${randomUUID()}@example.invalid`;
const password = 'Dashboard!Smoke2026';
const channel = 'heylaunch:dashboard-events:v1';
let userId;
let reader;
let abortController;

async function openStream(cookie) {
  abortController = new AbortController();
  const response = await fetch(new URL('/api/dashboard/events', baseUrl), {
    headers: { cookie },
    signal: abortController.signal,
  });
  assert.equal(response.status, 200, `SSE connection failed with HTTP ${response.status}`);
  assert.match(response.headers.get('content-type') || '', /^text\/event-stream/i);
  reader = response.body.getReader();
  return reader;
}

async function readUntilInvalidation(stream, timeoutMs = 5000) {
  const decoder = new TextDecoder();
  let buffer = '';
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let timer;
    const remaining = deadline - Date.now();
    const next = await Promise.race([
      stream.read(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out waiting for SSE invalidation.')), remaining); }),
    ]).finally(() => clearTimeout(timer));
    if (next.done) throw new Error('SSE stream closed before an invalidation arrived.');
    buffer += decoder.decode(next.value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';
    for (const frame of frames) {
      const lines = frame.split(/\r?\n/);
      if (!lines.some((line) => line === 'event:invalidate')) continue;
      const rawData = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
      return JSON.parse(rawData);
    }
  }
  throw new Error('Timed out waiting for SSE invalidation.');
}

async function waitForStreamSubscriber(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const subscribers = await redis.pubsub('NUMSUB', channel);
    if (Number(subscribers?.[1]) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The API did not subscribe to dashboard invalidations in time.');
}

async function main() {
  await prisma.$connect();
  await redis.ping();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: 'Dashboard event smoke', isVerified: true },
    select: { id: true },
  });
  userId = user.id;

  const login = await fetch(new URL('/api/auth/login', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 201, 'Synthetic verified user login failed.');
  const cookie = login.headers.getSetCookie().map((header) => header.split(';', 1)[0]).join('; ');
  assert.match(cookie, /(?:^|; )access_token=/, 'Login did not issue an access cookie.');

  const unauthenticated = await fetch(new URL('/api/dashboard/events', baseUrl));
  assert.ok(unauthenticated.status === 401 || unauthenticated.status === 403,
    `Unauthenticated SSE request was not rejected (HTTP ${unauthenticated.status}).`);

  const stream = await openStream(cookie);
  // Wait for the API's dedicated Redis subscriber instead of relying on a
  // timing guess. This runs only against the loopback Redis guard above.
  await waitForStreamSubscriber();
  await redis.publish(channel, JSON.stringify({ userId, resource: 'delivery', at: Date.now() }));
  const event = await readUntilInvalidation(stream);
  assert.deepEqual(Object.keys(event).sort(), ['at', 'resource']);
  assert.equal(event.resource, 'delivery');
  assert.equal(typeof event.at, 'number');
  console.log('Authenticated dashboard SSE received an owner-scoped Redis invalidation; unauthenticated access was rejected.');
}

main().catch((error) => {
  console.error(error.message || 'Dashboard event smoke test failed.');
  process.exitCode = 1;
}).finally(async () => {
  abortController?.abort();
  try { await reader?.cancel(); } catch { /* Stream may already be aborted. */ }
  if (userId) {
    try { await prisma.user.delete({ where: { id: userId } }); } catch { /* CI cleanup continues on test failure. */ }
  }
  await Promise.allSettled([redis.quit(), prisma.$disconnect()]);
});
