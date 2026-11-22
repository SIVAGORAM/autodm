const assert = require('node:assert/strict');
const { createHash, createHmac, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const baseUrl = new URL(process.env.API_SMOKE_BASE_URL || 'http://127.0.0.1:4000');
if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '::1'].includes(baseUrl.hostname)) {
  throw new Error('Auth smoke test is restricted to a loopback API with NODE_ENV=test.');
}

function requireLoopbackService(name) {
  const raw = process.env[name];
  let target;
  try {
    target = new URL(raw);
  } catch {
    throw new Error(`Auth smoke test requires a valid ${name} pointing to a loopback service.`);
  }
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(target.hostname)) {
    throw new Error(`Auth smoke test refuses non-loopback ${name} targets.`);
  }
}

requireLoopbackService('DATABASE_URL');
if (process.env.DIRECT_URL) requireLoopbackService('DIRECT_URL');
requireLoopbackService('REDIS_URL');

const policySource = readFileSync(path.join(__dirname, '..', 'src', 'legal', 'policy-versions.ts'), 'utf8');
function policyVersion(name) {
  const match = policySource.match(new RegExp(`export const ${name} = '([^']+)'`));
  assert.ok(match, `${name} must be defined in policy-versions.ts`);
  return match[1];
}

const prisma = new PrismaClient();
const email = `auth-smoke-${randomUUID()}@example.invalid`;
const password = 'Smoke!Pass123';
const allowedOrigin = process.env.API_SMOKE_ALLOWED_ORIGIN || 'http://localhost:3000';
let userId;
let deletionRaceOrderId;

function mergeCookies(existing, setCookies) {
  const cookies = new Map((existing || '').split(';').filter(Boolean).map((part) => {
    const [name, ...value] = part.trim().split('=');
    return [name, value.join('=')];
  }));
  for (const header of setCookies) {
    const pair = header.split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function request(route, { method = 'GET', body, cookie, origin } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const response = await fetch(new URL(route, baseUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { response, json, setCookies: response.headers.getSetCookie() };
}

function cookieValue(cookie, name) {
  const prefix = `${name}=`;
  return (cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
}

function isExpiredCookieHeader(headers, name) {
  const header = headers.find((value) => value.startsWith(`${name}=;`));
  const expires = header?.match(/expires=([^;]+)/i)?.[1];
  return !!expires && Date.parse(expires) < Date.now();
}

function jwtPayload(token) {
  const parts = token?.split('.');
  assert.equal(parts?.length, 3, 'JWT cookie should contain a signed JWT');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

async function main() {
  await prisma.$connect();

  const signup = await request('/api/auth/signup', {
    method: 'POST',
    body: {
      name: 'Auth smoke test', email, password,
      termsAccepted: true, privacyAcknowledged: true, ageConfirmed: true,
      termsVersion: policyVersion('TERMS_VERSION'),
      privacyVersion: policyVersion('PRIVACY_VERSION'),
    },
  });
  userId = signup.json?.data?.user?.id;
  assert.equal(signup.response.status, 201, `signup failed: ${JSON.stringify(signup.json)}`);
  assert.equal(signup.json?.success, true);
  assert.equal(signup.json?.data?.user?.email, email);
  assert.equal('accessToken' in (signup.json?.data || {}), false, 'access token must not be returned in JSON');
  assert.equal('refreshToken' in (signup.json?.data || {}), false, 'refresh token must not be returned in JSON');
  assert.ok(signup.setCookies.some((value) => /^access_token=/.test(value)), 'access cookie should be set');
  assert.ok(signup.setCookies.some((value) => /^refresh_token=/.test(value)), 'refresh cookie should be set');
  assert.ok(signup.setCookies.every((value) => /httponly/i.test(value)), 'auth cookies should be HttpOnly');
  const initialCookies = mergeCookies('', signup.setCookies);
  const initialRefreshToken = cookieValue(initialCookies, 'refresh_token');
  assert.ok(initialRefreshToken);
  const initialPayload = jwtPayload(initialRefreshToken);
  const persistedToken = await prisma.refreshToken.findUnique({
    where: { id: initialPayload.jti },
    select: { tokenHash: true, userId: true },
  });
  assert.equal(persistedToken?.userId, userId, 'refresh session should be stored for the new user');
  assert.notEqual(persistedToken?.tokenHash, initialRefreshToken, 'raw refresh token must not be persisted');
  assert.equal(persistedToken?.tokenHash, createHash('sha256').update(initialRefreshToken).digest('hex'));

  const storedUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { termsVersion: true, termsAcceptedAt: true, privacyVersion: true, privacyAcknowledgedAt: true, ageConfirmedAt: true },
  });
  assert.equal(storedUser?.termsVersion, policyVersion('TERMS_VERSION'));
  assert.equal(storedUser?.privacyVersion, policyVersion('PRIVACY_VERSION'));
  assert.ok(storedUser?.termsAcceptedAt && storedUser?.privacyAcknowledgedAt && storedUser?.ageConfirmedAt,
    'policy acceptance timestamps should persist');

  const me = await request('/api/auth/me', { cookie: initialCookies });
  assert.equal(me.response.status, 200, `cookie-authenticated /me failed: ${JSON.stringify(me.json)}`);
  assert.equal(me.json?.data?.user?.email, email);

  const rotated = await request('/api/auth/refresh', {
    method: 'POST', cookie: initialCookies, origin: allowedOrigin,
  });
  assert.equal(rotated.response.status, 201, `refresh failed: ${JSON.stringify(rotated.json)}`);
  const rotatedCookies = mergeCookies(initialCookies, rotated.setCookies);
  const rotatedRefreshToken = cookieValue(rotatedCookies, 'refresh_token');
  assert.ok(rotatedRefreshToken && rotatedRefreshToken !== initialRefreshToken, 'refresh should rotate the session token');

  const replay = await request('/api/auth/refresh', {
    method: 'POST', cookie: initialCookies, origin: allowedOrigin,
  });
  assert.equal(replay.response.status, 401, 'reusing a rotated refresh token must be rejected');
  const revokedSuccessor = await request('/api/auth/refresh', {
    method: 'POST', cookie: rotatedCookies, origin: allowedOrigin,
  });
  assert.equal(revokedSuccessor.response.status, 401, 'refresh-token reuse should revoke the token family');

  const originlessMutation = await request('/api/auth/logout', { method: 'POST', cookie: initialCookies });
  assert.equal(originlessMutation.response.status, 403, 'cookie-authenticated mutation without Origin must be rejected');
  const hostileOriginMutation = await request('/api/auth/logout', {
    method: 'POST', cookie: initialCookies, origin: 'https://attacker.invalid',
  });
  assert.equal(hostileOriginMutation.response.status, 403, 'cookie-authenticated mutation from an untrusted Origin must be rejected');

  const login = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(login.response.status, 201, `login failed: ${JSON.stringify(login.json)}`);
  const loginCookies = mergeCookies('', login.setCookies);
  const logout = await request('/api/auth/logout', {
    method: 'POST', cookie: loginCookies, origin: allowedOrigin,
  });
  assert.equal(logout.response.status, 201, `logout failed: ${JSON.stringify(logout.json)}`);
  const afterLogout = await request('/api/auth/refresh', {
    method: 'POST', cookie: loginCookies, origin: allowedOrigin,
  });
  assert.equal(afterLogout.response.status, 401, 'logged-out refresh token must no longer work');

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  assert.ok(webhookSecret, 'CI must provide a test-only webhook signing key');
  const ignoredEvent = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_smoke', order_id: 'order_smoke' } } } });
  const signedWebhook = createHmac('sha256', webhookSecret).update(ignoredEvent).digest('hex');
  const validWebhookResponse = await fetch(new URL('/api/payments/webhook', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': signedWebhook },
    body: ignoredEvent,
  });
  assert.equal(validWebhookResponse.status, 201, 'signed payment webhook should pass raw-body validation');
  assert.deepEqual(await validWebhookResponse.json(), { received: true, applied: false });

  const beforeInvalidCapture = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpiresAt: true },
  });
  const capturedEvent = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_smoke_capture', order_id: 'order_smoke_capture' } } },
  });
  const invalidWebhookResponse = await fetch(new URL('/api/payments/webhook', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': '0'.repeat(64) },
    body: capturedEvent,
  });
  assert.equal(invalidWebhookResponse.status, 400, 'invalid webhook signature must be rejected');
  const afterInvalidCapture = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planExpiresAt: true },
  });
  assert.deepEqual(afterInvalidCapture, beforeInvalidCapture, 'invalid captured-payment webhook must not change the user plan');
  assert.equal(await prisma.payment.count({ where: { userId } }), 0, 'invalid captured-payment webhook must not persist a payment');

  const deletionLogin = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(deletionLogin.response.status, 201, `pre-deletion login failed: ${JSON.stringify(deletionLogin.json)}`);
  const deletionCookies = mergeCookies('', deletionLogin.setCookies);
  const deletion = await request('/api/users/account', {
    method: 'DELETE',
    cookie: deletionCookies,
    origin: allowedOrigin,
    body: { currentPassword: password, confirmationEmail: email },
  });
  assert.equal(deletion.response.status, 200, `account deletion request failed: ${JSON.stringify(deletion.json)}`);
  assert.equal(deletion.json?.success, true);
  assert.ok(deletion.json?.data?.requestedAt && deletion.json?.data?.scheduledFor,
    'account deletion should report its accepted and scheduled times');
  assert.ok(isExpiredCookieHeader(deletion.setCookies, 'access_token'),
    'account deletion should clear the access cookie');
  assert.ok(isExpiredCookieHeader(deletion.setCookies, 'refresh_token'),
    'account deletion should clear the refresh cookie');

  const tombstone = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, isVerified: true, deletionRequestedAt: true },
  });
  assert.equal(tombstone?.email, `deleted-${userId}@account.invalid`);
  assert.equal(tombstone?.name, 'Deleted account');
  assert.equal(tombstone?.isVerified, false);
  assert.ok(tombstone?.deletionRequestedAt instanceof Date && !Number.isNaN(tombstone.deletionRequestedAt.getTime()),
    'account deletion should immediately anonymize and lock the account');
  assert.equal(await prisma.refreshToken.count({ where: { userId } }), 0,
    'account deletion should immediately revoke persisted refresh sessions');
  const deletedAccountMe = await request('/api/auth/me', { cookie: deletionCookies });
  assert.equal(deletedAccountMe.response.status, 401,
    'account deletion should reject the previously authenticated access session');

  // Exercise the captured-payment/deletion race against CI PostgreSQL. The
  // provider object is mocked so this never contacts Razorpay.
  const { PaymentsService } = require(path.join(__dirname, '..', 'dist', 'payments', 'payments.service.js'));
  const { PLANS } = require(path.join(__dirname, '..', 'dist', 'common', 'plan.config.js'));
  const webhookOrderId = `order_deleted_${randomUUID()}`;
  const webhookPaymentId = `pay_deleted_${randomUUID()}`;
  deletionRaceOrderId = webhookOrderId;
  const paymentService = new PaymentsService({
    get: (key) => key === 'RAZORPAY_WEBHOOK_SECRET' ? webhookSecret : undefined,
  }, prisma);
  paymentService.rzp = {
    orders: { fetch: async () => ({
      status: 'paid', notes: { userId, plan: 'CREATOR' },
      amount: PLANS.CREATOR.pricePaise, currency: 'INR',
    }) },
    payments: { fetch: async () => ({
      order_id: webhookOrderId, status: 'captured',
      amount: PLANS.CREATOR.pricePaise, currency: 'INR',
    }) },
  };
  const deletionRaceEvent = Buffer.from(JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: webhookPaymentId, order_id: webhookOrderId } } },
  }));
  const deletionRaceSignature = createHmac('sha256', webhookSecret).update(deletionRaceEvent).digest('hex');
  assert.deepEqual(await paymentService.processWebhook(deletionRaceEvent, deletionRaceSignature), {
    received: true, applied: false,
  }, 'capture after deletion starts should be acknowledged without restoring access');
  const detachedPayment = await prisma.payment.findUnique({ where: { orderId: webhookOrderId } });
  assert.equal(detachedPayment?.paymentId, webhookPaymentId);
  assert.equal(detachedPayment?.userId, null, 'captured payment should be preserved without reattaching a deleting user');
  const deletedUserPlan = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true } });
  assert.deepEqual(deletedUserPlan, { plan: 'FREE', planExpiresAt: null },
    'late payment capture must not grant plan access after account deletion starts');

  console.log('Smoke passed: auth persistence/cookies/token rotation/replay defense/CSRF/login/logout/account deletion, deletion-safe captured-payment reconciliation, and Razorpay signature/no-entitlement checks.');
}

main()
  .catch((error) => {
    console.error(`Auth smoke failed: ${error?.message || 'unknown error'}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (deletionRaceOrderId) await prisma.payment.deleteMany({ where: { orderId: deletionRaceOrderId } }).catch(() => {});
    await prisma.user.deleteMany({ where: userId ? { id: userId } : { email } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });
