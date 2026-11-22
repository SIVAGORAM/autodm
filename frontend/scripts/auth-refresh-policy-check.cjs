const assert = require('node:assert/strict');
const { shouldSkipAuthRefresh } = require('../lib/auth-refresh-policy.cjs');

for (const route of [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-otp',
]) {
  assert.equal(shouldSkipAuthRefresh(route), true, `${route} must not be retried`);
}

for (const route of ['/auth/me', '/auth/verification-email-status', '/auth/resend-otp', '/automations']) {
  assert.equal(shouldSkipAuthRefresh(route), false, `${route} should be eligible for refresh`);
}

assert.equal(shouldSkipAuthRefresh('/auth/login?next=/dashboard'), true);
assert.equal(shouldSkipAuthRefresh(undefined), false);
console.log('Auth refresh policy checks passed (13 assertions).');
