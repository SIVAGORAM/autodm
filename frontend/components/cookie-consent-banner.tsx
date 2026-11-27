'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X, Check, SlidersHorizontal, ShieldCheck } from 'lucide-react';
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
      className="heylaunch-cookie-banner"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(1060px, calc(100vw - 36px))',
        zIndex: 99999,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '24px 28px',
        boxShadow: '0 24px 54px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px var(--border)',
        color: 'var(--text)',
        fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        animation: 'heylaunchSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes heylaunchSlideUp {
          from { opacity: 0; transform: translate(-50%, 24px) scale(0.98); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @media (max-width: 960px) {
          .heylaunch-cookie-banner {
            bottom: 12px !important;
            padding: 18px 20px !important;
            width: calc(100vw - 20px) !important;
            border-radius: 16px !important;
          }
          .heylaunch-cookie-main-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .heylaunch-cookie-actions {
            width: 100% !important;
            justify-content: flex-end !important;
            flex-wrap: wrap !important;
          }
          .heylaunch-cookie-btn {
            flex: 1 1 auto !important;
            height: 42px !important;
            text-align: center !important;
            justify-content: center !important;
          }
        }
      `}</style>

      {!showDetails ? (
        /* ─── Comfortable, Premium Height Horizontal Bar ─── */
        <div
          className="heylaunch-cookie-main-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          {/* Left info cluster */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flex: '1 1 540px', minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--card-hover)',
                border: '1px solid var(--border)',
                color: 'var(--lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <Cookie size={22} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 750, letterSpacing: '-0.3px', color: 'var(--text)' }}>
                  We Value Your Privacy &amp; Data Transparency
                </h4>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--success)',
                    background: 'var(--success-soft)',
                    padding: '2px 8px',
                    borderRadius: 999,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  DPDP &amp; GDPR Compliant
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-muted)' }}>
                HeyLaunch uses strictly necessary cookies to keep you signed in securely and optional performance cookies to optimize your automations. See our{' '}
                <Link
                  href="/cookies"
                  style={{
                    color: 'var(--text)',
                    fontWeight: 650,
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  Cookie Policy &rarr;
                </Link>
              </p>
            </div>
          </div>

          {/* Right action buttons cluster */}
          <div
            className="heylaunch-cookie-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="heylaunch-cookie-btn"
              style={{
                height: 44,
                padding: '0 16px',
                borderRadius: 11,
                border: '1px solid var(--border)',
                background: 'var(--card-hover)',
                color: 'var(--text)',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
              }}
            >
              <SlidersHorizontal size={15} /> Preferences
            </button>

            <button
              type="button"
              onClick={handleRejectAll}
              className="heylaunch-cookie-btn"
              style={{
                height: 44,
                padding: '0 16px',
                borderRadius: 11,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              Reject Optional
            </button>

            <button
              type="button"
              onClick={handleAcceptAll}
              className="heylaunch-cookie-btn"
              style={{
                height: 44,
                padding: '0 20px',
                borderRadius: 11,
                border: 'none',
                background: 'var(--btn-primary)',
                color: 'var(--btn-primary-text)',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                transition: 'opacity 0.15s ease',
              }}
            >
              <Check size={16} /> Accept All
            </button>

            <button
              type="button"
              aria-label="Dismiss banner"
              onClick={() => setVisible(false)}
              style={{
                width: 36,
                height: 36,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: 9,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 2,
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>
      ) : (
        /* ─── Expanded Preferences Panel (Spacious, Premium Height) ─── */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'var(--card-hover)',
                  border: '1px solid var(--border)',
                  color: 'var(--lime)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={21} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: 'var(--text)' }}>
                  Manage Cookie Preferences
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Choose which cookie categories you want enabled while using the HeyLaunch platform.
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Close preferences view"
              onClick={() => setShowDetails(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* 3 Spacious Category Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            {/* Category 1: Strictly Necessary */}
            <div
              style={{
                padding: '16px 18px',
                background: 'var(--card-hover)',
                borderRadius: 14,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Strictly Necessary</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 750,
                    color: 'var(--success)',
                    background: 'var(--success-soft)',
                    padding: '3px 9px',
                    borderRadius: 999,
                  }}
                >
                  Always Active
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Cryptographically signed auth tokens, CSRF protection, and session security essential for platform operations.
              </p>
            </div>

            {/* Category 2: Preferences */}
            <div
              style={{
                padding: '16px 18px',
                background: 'var(--card-hover)',
                borderRadius: 14,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Preferences &amp; UI</span>
                <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, cursor: 'pointer' }}>
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
                      borderRadius: 22,
                      transition: '0.2s',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        height: 16,
                        width: 16,
                        left: functional ? 21 : 3,
                        bottom: 3,
                        backgroundColor: functional ? 'var(--lime)' : 'var(--text-muted)',
                        borderRadius: '50%',
                        transition: '0.2s',
                      }}
                    />
                  </span>
                </label>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Appearance settings (dark/light themes), collapsed navigation state, and regional language preferences.
              </p>
            </div>

            {/* Category 3: Analytics */}
            <div
              style={{
                padding: '16px 18px',
                background: 'var(--card-hover)',
                borderRadius: 14,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Analytics &amp; Speed</span>
                <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, cursor: 'pointer' }}>
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
                      borderRadius: 22,
                      transition: '0.2s',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        height: 16,
                        width: 16,
                        left: analytics ? 21 : 3,
                        bottom: 3,
                        backgroundColor: analytics ? 'var(--lime)' : 'var(--text-muted)',
                        borderRadius: '50%',
                        transition: '0.2s',
                      }}
                    />
                  </span>
                </label>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Aggregated, anonymized performance telemetry measuring platform latencies and server delivery reliability.
              </p>
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Full policy and cookie list on our{' '}
              <Link href="/cookies" style={{ color: 'var(--text)', fontWeight: 650, textDecoration: 'underline' }}>
                Cookie Documentation &rarr;
              </Link>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                style={{
                  height: 42,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSaveCustom}
                style={{
                  height: 42,
                  padding: '0 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--btn-primary)',
                  color: 'var(--btn-primary-text)',
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <Check size={15} /> Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
