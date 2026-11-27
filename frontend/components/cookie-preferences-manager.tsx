'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  CookieConsentState,
  COOKIE_CONSENT_EVENT,
  getStoredCookieConsent,
  setStoredCookieConsent,
} from '../lib/cookie-consent';

export function CookiePreferencesManager() {
  const [consent, setConsent] = useState<CookieConsentState | null>(null);
  const [functional, setFunctional] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const current = getStoredCookieConsent();
    setConsent(current);
    setFunctional(current.functional);
    setAnalytics(current.analytics);

    const onUpdate = (e: Event) => {
      const custom = e as CustomEvent<CookieConsentState>;
      if (custom.detail) {
        setConsent(custom.detail);
        setFunctional(custom.detail.functional);
        setAnalytics(custom.detail.analytics);
      }
    };
    window.addEventListener(COOKIE_CONSENT_EVENT, onUpdate);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onUpdate);
  }, []);

  const handleSave = () => {
    const updated = setStoredCookieConsent({ functional, analytics });
    setConsent(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  const handleAcceptAll = () => {
    setFunctional(true);
    setAnalytics(true);
    const updated = setStoredCookieConsent({ functional: true, analytics: true });
    setConsent(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  const handleRejectAll = () => {
    setFunctional(false);
    setAnalytics(false);
    const updated = setStoredCookieConsent({ functional: false, analytics: false });
    setConsent(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  if (!consent) return null;

  return (
    <div
      style={{
        margin: '28px 0',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(23, 130, 126, 0.12)',
              color: '#17827E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              Live Cookie Preferences Manager
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {consent.decided
                ? `Last updated on ${new Date(consent.timestamp).toLocaleDateString()} at ${new Date(consent.timestamp).toLocaleTimeString()}`
                : 'Default configuration active (no non-essential cookies enabled)'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleAcceptAll}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #17827E',
              background: '#17827E',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 650,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Check size={14} /> Accept All
          </button>
          <button
            type="button"
            onClick={handleRejectAll}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RotateCcw size={14} /> Reject Optional
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
        {/* Category 1: Strictly Necessary */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 15, color: 'var(--text)' }}>Strictly Necessary Cookies</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#16a34a',
                }}
              >
                Always Active
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Required for basic website navigation, secure authentication, session persistence, CSRF protection, and fraud prevention. The platform cannot function properly without these cookies.
            </p>
          </div>
          <div style={{ opacity: 0.6, fontSize: 12, fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>
            Locked
          </div>
        </div>

        {/* Category 2: Functional & Preferences */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 15, color: 'var(--text)' }}>Preferences &amp; Functional Cookies</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: functional ? 'rgba(23, 130, 126, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                  color: functional ? '#17827E' : 'var(--text-muted)',
                }}
              >
                {functional ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Remember your personalized dashboard layout, chosen UI language, theme mode, and sidebar toggle preferences across visits.
            </p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
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
                backgroundColor: functional ? '#17827E' : 'rgba(100, 116, 139, 0.3)',
                borderRadius: 24,
                transition: '0.2s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: 18,
                  width: 18,
                  left: functional ? 22 : 3,
                  bottom: 3,
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: '0.2s',
                }}
              />
            </span>
          </label>
        </div>

        {/* Category 3: Analytics & Performance */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 15, color: 'var(--text)' }}>Analytics &amp; Performance Cookies</strong>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: analytics ? 'rgba(23, 130, 126, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                  color: analytics ? '#17827E' : 'var(--text-muted)',
                }}
              >
                {analytics ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Collect aggregated, anonymous usage telemetry (such as page response speed and feature interactions) to help us diagnose performance bottlenecks and optimize HeyLaunch for creators.
            </p>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
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
                backgroundColor: analytics ? '#17827E' : 'rgba(100, 116, 139, 0.3)',
                borderRadius: 24,
                transition: '0.2s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: 18,
                  width: 18,
                  left: analytics ? 22 : 3,
                  bottom: 3,
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: '0.2s',
                }}
              />
            </span>
          </label>
        </div>
      </div>

      <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            border: 'none',
            background: '#17827E',
            color: '#ffffff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(23, 130, 126, 0.25)',
          }}
        >
          Save Custom Preferences
        </button>

        {savedNotice && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#16a34a',
              fontSize: 13,
              fontWeight: 650,
            }}
          >
            <ShieldCheck size={16} /> Preferences saved in real-time!
          </div>
        )}
      </div>
    </div>
  );
}
