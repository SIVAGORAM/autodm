'use strict';

const LOGIN_OPTIONS_INCOMPLETE = 'The Instagram login configuration response is incomplete. Confirm that the frontend API proxy points to a matching Nest backend deployment.';
const AUTH_URL_MISMATCH = 'The Meta login URL does not match this site’s Instagram configuration. Verify the App ID, login mode, and callback URL; start OAuth from the same site origin configured for the callback.';

const loginOptionStringFields = [
  'instagramLoginAppId',
  'unifiedLoginAppId',
  'unifiedLoginConfigId',
  'oauthRedirectUri',
  'webhookCallbackUrl',
];

function parseInstagramLoginOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.unifiedLoginEnabled !== 'boolean'
    || typeof value.liveCommentsEnabled !== 'boolean'
    || typeof value.instagramLoginUsesMetaFallback !== 'boolean'
    || loginOptionStringFields.some((field) => typeof value[field] !== 'string')) {
    throw new Error(LOGIN_OPTIONS_INCOMPLETE);
  }

  return {
    unifiedLoginEnabled: value.unifiedLoginEnabled,
    liveCommentsEnabled: value.liveCommentsEnabled,
    instagramLoginAppId: value.instagramLoginAppId,
    instagramLoginUsesMetaFallback: value.instagramLoginUsesMetaFallback,
    unifiedLoginAppId: value.unifiedLoginAppId,
    unifiedLoginConfigId: value.unifiedLoginConfigId,
    oauthRedirectUri: value.oauthRedirectUri,
    webhookCallbackUrl: value.webhookCallbackUrl,
  };
}

function validateMetaAuthorizationUrl(value, mode, options, frontendOrigin) {
  try {
    if (typeof value !== 'string' || !options || (mode !== 'INSTAGRAM_LOGIN' && mode !== 'UNIFIED_LOGIN')
      || typeof frontendOrigin !== 'string') {
      throw new Error('invalid input');
    }

    const url = new URL(value);
    const callbackUrl = new URL(options.oauthRedirectUri);
    const currentOrigin = new URL(frontendOrigin).origin;
    const expectedOrigin = mode === 'INSTAGRAM_LOGIN' ? 'https://www.instagram.com' : 'https://www.facebook.com';
    const expectedPath = mode === 'INSTAGRAM_LOGIN' ? '/oauth/authorize' : '/dialog/oauth';
    const expectedAppId = mode === 'INSTAGRAM_LOGIN' ? options.instagramLoginAppId : options.unifiedLoginAppId;
    if (url.origin !== expectedOrigin || url.pathname !== expectedPath || !expectedAppId
      // The state nonce cookie is host-only. A callback on another host cannot
      // receive it, so refuse to start OAuth from a preview/deployment alias.
      || callbackUrl.origin !== currentOrigin
      || url.searchParams.get('client_id') !== expectedAppId
      || url.searchParams.get('redirect_uri') !== options.oauthRedirectUri
      || url.searchParams.get('response_type') !== 'code'
      || (url.searchParams.get('state') ?? '').length < 20) {
      throw new Error('base URL mismatch');
    }

    if (mode === 'INSTAGRAM_LOGIN') {
      const scopes = new Set((url.searchParams.get('scope') ?? '').split(',').filter(Boolean));
      if (url.searchParams.get('enable_fb_login') !== 'false'
        || (url.searchParams.has('force_reauth') && url.searchParams.get('force_reauth') !== 'true')
        || !['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments'].every((scope) => scopes.has(scope))) {
        throw new Error('Instagram permissions mismatch');
      }
    } else if (!options.unifiedLoginEnabled
      || !options.unifiedLoginConfigId
      || url.searchParams.get('config_id') !== options.unifiedLoginConfigId
      || url.searchParams.get('override_default_response_type') !== 'true') {
      throw new Error('Unified Login configuration mismatch');
    }

    return url.toString();
  } catch {
    throw new Error(AUTH_URL_MISMATCH);
  }
}

module.exports = {
  LOGIN_OPTIONS_INCOMPLETE,
  AUTH_URL_MISMATCH,
  parseInstagramLoginOptions,
  validateMetaAuthorizationUrl,
};
