'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AtSign, ArrowRight } from 'lucide-react';
import { api, authApi, getApiErrorMessage } from '../../../services/api';
import { AuthBrand, AC } from '../../../components/auth-brand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-warm backend container while user enters email
  useEffect(() => {
    void api.get('/version').catch(() => undefined);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null); setMessage(null);
    try { await authApi.forgotPassword(email); setMessage('If that email has an account, a reset link is on its way.'); }
    catch (err: any) { setError(getApiErrorMessage(err, 'Something went wrong. Try again.')); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}.auth-grid{grid-template-columns:1fr !important}}.ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: 384 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.7px', color: AC.ink }}>Reset your password</h1>
          <p style={{ color: AC.muted, fontSize: 15, marginTop: 8 }}>Enter your email and we&rsquo;ll send a reset link.</p>
          {message && <div style={{ marginTop: 18, background: 'var(--success-soft)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{message}</div>}
          {error && <div style={{ marginTop: 18, background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <AtSign style={{ position: 'absolute', left: 14, top: 14, width: 18, height: 18, color: AC.muted }} />
              <input className="ai" aria-label="Email address" type="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 14px 0 42px', fontSize: 15, color: AC.ink }} />
            </div>
            <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 11, background: AC.teal, color: 'var(--btn-primary-text)', fontWeight: 600, fontSize: 15.5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? .7 : 1 }}>
              {loading ? 'Sending…' : <>Send reset link <ArrowRight style={{ width: 17, height: 17 }} /></>}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 22, fontSize: 14.5, color: AC.muted }}><Link href="/login" style={{ color: AC.teal, fontWeight: 600, textDecoration: 'none' }}>Back to log in</Link></p>
        </div>
      </div>
    </div>
  );
}
