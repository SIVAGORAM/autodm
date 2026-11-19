'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AtSign, ArrowRight } from 'lucide-react';
import { api } from '../../../services/api';
import { AuthBrand, AC } from '../../../components/auth-brand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null); setMessage(null);
    try { await api.post('/auth/forgot-password', { email }); setMessage('If that email has an account, a reset link is on its way.'); }
    catch (err: any) { setError(err.response?.data?.message || 'Something went wrong. Try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}}.ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: 384 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.7px', color: AC.ink }}>Reset your password</h1>
          <p style={{ color: AC.muted, fontSize: 15, marginTop: 8 }}>Enter your email and we&rsquo;ll send a reset link.</p>
          {message && <div style={{ marginTop: 18, background: '#E7F5EE', color: '#0F7A51', border: '1px solid #BFE6D4', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{message}</div>}
          {error && <div style={{ marginTop: 18, background: '#FDEBE3', color: '#B4411F', border: '1px solid #F7C7B5', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <AtSign style={{ position: 'absolute', left: 14, top: 14, width: 18, height: 18, color: AC.muted }} />
              <input className="ai" type="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 14px 0 42px', fontSize: 15, color: AC.ink }} />
            </div>
            <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 11, background: AC.teal, color: '#fff', fontWeight: 600, fontSize: 15.5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? .7 : 1 }}>
              {loading ? 'Sending…' : <>Send reset link <ArrowRight style={{ width: 17, height: 17 }} /></>}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 22, fontSize: 14.5, color: AC.muted }}><Link href="/login" style={{ color: AC.teal, fontWeight: 600, textDecoration: 'none' }}>Back to log in</Link></p>
        </div>
      </div>
    </div>
  );
}
