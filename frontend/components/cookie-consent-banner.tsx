'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X, Check, SlidersHorizontal } from 'lucide-react';
import {
  CookieConsentState,
  COOKIE_CONSENT_EVENT,
  OPEN_COOKIE_SETTINGS_EVENT,
  getStoredCookieConsent,
  setStoredCookieConsent,
} from '../lib/cookie-consent';

export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = getStoredCookieConsent();
    setFunctional(stored.functional);
    setAnalytics(stored.analytics);

    if (!stored.decided) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }

    const onOpen = () => {
      const current = getStoredCookieConsent();
      setFunctional(current.functional);
      setAnalytics(current.analytics);
      setShowDetails(true);
      setVisible(true);
    };

    const onUpdate = (e: Event) => {
      const custom = e as CustomEvent<CookieConsentState>;
      if (custom.detail) {
        setFunctional(custom.detail.functional);
        setAnalytics(custom.detail.analytics);
      }
    };

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen);
    window.addEventListener(COOKIE_CONSENT_EVENT, onUpdate);

    return () => {
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen);
      window.removeEventListener(COOKIE_CONSENT_EVENT, onUpdate);
    };
  }, []);

  if (!mounted || !visible) return null;

  const handleAcceptAll = () => {
    setStoredCookieConsent({ functional: true, analytics: true });
    setVisible(false);
  };

  const handleRejectAll = () => {
    setStoredCookieConsent({ functional: false, analytics: false });
    setVisible(false);
  };

  const handleSaveCustom = () => {
    setStoredCookieConsent({ functional, analytics });
    setVisible(false);
  };

  return (
    <aside
      aria-label="Cookie consent banner"
      role="region"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        left: 'auto',
        maxWidth: showDetails ? 460 : 420,
        width: 'calc(100vw - 36px)',
        zIndex: 99999,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-dialog, 16px)',
        padding: '20px 22px',
        boxShadow: 'var(--shadow-lg, 0 20px 48px -18px rgba(16, 24, 40, 0.20))',
        color: 'var(--text)',
        fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 640px) {
          aside[aria-label="Cookie consent banner"] {
            left: 18px !important;
            right: 18px !important;
            bottom: 18px !important;
            width: auto !important;
          }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--card-hover)',
              border: '1px solid var(--border)',
              color: 'var(--lime)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Cookie size={19} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 750, letterSpacing: '-0.3px', color: 'var(--text)' }}>
              We Value Your Privacy
            </h4>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              HeyLaunch Cookie Transparency
            </span>
          </div>
        </div>

        <button
          type="button"
          aria-label="Dismiss banner"
          onClick={() => setVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {!showDetails ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--text-muted)' }}>
            HeyLaunch uses strictly necessary cookies to keep you signed in securely and optional cookies to remember your preferences and enhance platform performance. See our{' '}
            <Link
              href="/cookies"
              style={{ color: 'var(--text)', fontWeight: 650, textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Cookie Policy
            </Link>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleAcceptAll}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--btn-primary)',
                  color: 'var(--btn-primary-text)',
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Check size={14} /> Accept All
              </button>

              <button
                type="button"
                onClick={handleRejectAll}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Reject Optional
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails(true)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <SlidersHorizontal size={13} /> Customize Cookie Preferences
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gap: 10, maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
            {/* Category 1 */}
            <div style={{ padding: '10px 12px', background: 'var(--card-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Strictly Necessary</span>
                <span style={{ fontSize: 10.5, fontWeight: 750, color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 7px', borderRadius: 999 }}>Always Active</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Authentication tokens, CSRF tokens, and security states required for normal functioning.
              </p>
            </div>

            {/* Category 2 */}
            <div style={{ padding: '10px 12px', background: 'var(--card-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Preferences &amp; UI</span>
                <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={functional}
                    onChange={(e) => setFunctional(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: functional ? 'var(--btn-primary)' : 'var(--border)',
                      borderRadius: 20,
                      transition: '0.2s',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: 14,
                        width: 14,
                        left: functional ? 19 : 3,
                        bottom: 3,
                        backgroundColor: functional ? 'var(--lime)' : 'var(--text-muted)',
                        borderRadius: '50%',
                        transition: '0.2s',
                      }}
                    />
                  </span>
                </label>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Theme choices, collapsed navigation, and regional language preferences.
              </p>
            </div>

            {/* Category 3 */}
            <div style={{ padding: '10px 12px', background: 'var(--card-hover)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Performance &amp; Analytics</span>
                <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: analytics ? 'var(--btn-primary)' : 'var(--border)',
                      borderRadius: 20,
                      transition: '0.2s',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: 14,
                        width: 14,
                        left: analytics ? 19 : 3,
                        bottom: 3,
                        backgroundColor: analytics ? 'var(--lime)' : 'var(--text-muted)',
                        borderRadius: '50%',
                        transition: '0.2s',
                      }}
                    />
                  </span>
                </label>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Aggregated, anonymized performance metrics to measure platform latency and page reliability.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={handleSaveCustom}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: 'none',
                background: 'var(--btn-primary)',
                color: 'var(--btn-primary-text)',
                fontSize: 13,
                fontWeight: 650,
                cursor: 'pointer',
              }}
            >
              Save Preferences
            </button>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              style={{
                padding: '0 12px',
                height: 38,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
