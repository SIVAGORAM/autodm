'use client';

export type CookieConsentState = {
  essential: true;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
  decided: boolean;
};

export const COOKIE_CONSENT_KEY = 'heylaunch_cookie_consent_v1';
export const COOKIE_CONSENT_EVENT = 'heylaunch:cookie-consent-updated';
export const OPEN_COOKIE_SETTINGS_EVENT = 'heylaunch:open-cookie-settings';

export const DEFAULT_CONSENT: CookieConsentState = {
  essential: true,
  functional: false,
  analytics: false,
  timestamp: '',
  decided: false,
};

export function getStoredCookieConsent(): CookieConsentState {
  if (typeof window === 'undefined') return DEFAULT_CONSENT;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return DEFAULT_CONSENT;
    const parsed = JSON.parse(raw);
    return {
      essential: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
      decided: Boolean(parsed.decided),
    };
  } catch {
    return DEFAULT_CONSENT;
  }
}

export function setStoredCookieConsent(consent: { functional: boolean; analytics: boolean }): CookieConsentState {
  if (typeof window === 'undefined') return DEFAULT_CONSENT;
  const state: CookieConsentState = {
    essential: true,
    functional: Boolean(consent.functional),
    analytics: Boolean(consent.analytics),
    timestamp: new Date().toISOString(),
    decided: true,
  };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: state }));
  } catch {}
  return state;
}

export function openCookieSettings() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS_EVENT));
}
