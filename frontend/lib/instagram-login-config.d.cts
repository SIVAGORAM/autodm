export type InstagramLoginMode = 'INSTAGRAM_LOGIN' | 'UNIFIED_LOGIN';
export type InstagramLoginOptions = {
  unifiedLoginEnabled: boolean;
  liveCommentsEnabled: boolean;
  instagramLoginAppId: string;
  instagramLoginUsesMetaFallback: boolean;
  unifiedLoginAppId: string;
  unifiedLoginConfigId: string;
  oauthRedirectUri: string;
  webhookCallbackUrl: string;
};

export const LOGIN_OPTIONS_INCOMPLETE: string;
export const AUTH_URL_MISMATCH: string;
export function parseInstagramLoginOptions(value: unknown): InstagramLoginOptions;
export function validateMetaAuthorizationUrl(value: unknown, mode: InstagramLoginMode, options: InstagramLoginOptions, frontendOrigin: string): string;
