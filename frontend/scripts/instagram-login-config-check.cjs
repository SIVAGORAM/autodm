'use strict';

const assert = require('node:assert/strict');
const {
  LOGIN_OPTIONS_INCOMPLETE,
  AUTH_URL_MISMATCH,
  parseInstagramLoginOptions,
  validateMetaAuthorizationUrl,
} = require('../lib/instagram-login-config.cjs');

const options = {
  unifiedLoginEnabled: true,
  liveCommentsEnabled: false,
  instagramLoginAppId: 'instagram-app-id',
  instagramLoginUsesMetaFallback: false,
  unifiedLoginAppId: 'meta-app-id',
  unifiedLoginConfigId: '1848584173153195',
  oauthRedirectUri: 'https://app.example.test/api/instagram/callback',
  webhookCallbackUrl: 'https://api.example.test/webhooks/instagram',
};

assert.deepEqual(parseInstagramLoginOptions(options), options);
assert.throws(() => parseInstagramLoginOptions({ ...options, unifiedLoginEnabled: undefined }), { message: LOGIN_OPTIONS_INCOMPLETE });

const instagramUrl = new URL('https://www.instagram.com/oauth/authorize');
instagramUrl.search = new URLSearchParams({
  client_id: options.instagramLoginAppId,
  redirect_uri: options.oauthRedirectUri,
  response_type: 'code',
  scope: 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments',
  enable_fb_login: 'false',
  force_reauth: 'true',
  state: 'a'.repeat(40),
}).toString();
assert.equal(validateMetaAuthorizationUrl(instagramUrl.toString(), 'INSTAGRAM_LOGIN', options, 'https://app.example.test'), instagramUrl.toString());
assert.throws(() => validateMetaAuthorizationUrl(instagramUrl.toString(), 'INSTAGRAM_LOGIN', options, 'https://preview.example.test'), { message: AUTH_URL_MISMATCH });
const missingForceReauthUrl = new URL(instagramUrl.toString());
missingForceReauthUrl.searchParams.delete('force_reauth');
assert.throws(() => validateMetaAuthorizationUrl(missingForceReauthUrl.toString(), 'INSTAGRAM_LOGIN', options, 'https://app.example.test'), { message: AUTH_URL_MISMATCH });

const unifiedUrl = new URL('https://www.facebook.com/dialog/oauth');
unifiedUrl.search = new URLSearchParams({
  client_id: options.unifiedLoginAppId,
  config_id: options.unifiedLoginConfigId,
  redirect_uri: options.oauthRedirectUri,
  response_type: 'code',
  override_default_response_type: 'true',
  state: 'b'.repeat(40),
}).toString();
assert.equal(validateMetaAuthorizationUrl(unifiedUrl.toString(), 'UNIFIED_LOGIN', options, 'https://app.example.test'), unifiedUrl.toString());
const incompatibleOverrideUrl = new URL(unifiedUrl.toString());
incompatibleOverrideUrl.searchParams.delete('override_default_response_type');
assert.throws(() => validateMetaAuthorizationUrl(incompatibleOverrideUrl.toString(), 'UNIFIED_LOGIN', options, 'https://app.example.test'), { message: AUTH_URL_MISMATCH });
assert.throws(() => validateMetaAuthorizationUrl(unifiedUrl.toString(), 'INSTAGRAM_LOGIN', options, 'https://app.example.test'), { message: AUTH_URL_MISMATCH });
assert.throws(() => validateMetaAuthorizationUrl('https://evil.example/authorize', 'UNIFIED_LOGIN', options, 'https://app.example.test'), { message: AUTH_URL_MISMATCH });

console.log('Instagram login configuration checks passed.');
