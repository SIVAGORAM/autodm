'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';
import { api } from '../../../services/api';
import { AuthBrand, AC } from '../../../components/auth-brand';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');
    setLoading(true); setError(null);
    try { await api.post('/auth/reset-password', { token, password }); router.push('/login'); }
    catch (err: any) { setError(err.response?.data?.message || 'This reset link is invalid or expired.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ width: '100%', maxWidth: 384 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.7px', color: AC.ink }}>Set a new password</h1>
      <p style={{ color: AC.muted, fontSize: 15, marginTop: 8 }}>Choose a strong password you don&rsquo;t use elsewhere.</p>
      {error && <div style={{ marginTop: 18, background: '#FDEBE3', color: '#B4411F', border: '1px solid #F7C7B5', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[['New password', password, setPassword], ['Confirm new password', confirmPassword, setConfirmPassword]].map(([ph, val, set]: any) => (
          <div key={ph} style={{ position: 'relative' }}>
            <Lock style={{ position: 'absolute', left: 14, top: 14, width: 18, height: 18, color: AC.muted }} />
            <input className="ai" type="password" required placeholder={ph} value={val} onChange={(e) => set(e.target.value)}
              style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 14px 0 42px', fontSize: 15, color: AC.ink }} />
          </div>
        ))}
        <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 11, background: AC.teal, color: '#fff', fontWeight: 600, fontSize: 15.5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? .7 : 1 }}>
          {loading ? 'Updating…' : <>Update password <ArrowRight style={{ width: 17, height: 17 }} /></>}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: 22, fontSize: 14.5, color: AC.muted }}><Link href="/login" style={{ color: AC.teal, fontWeight: 600, textDecoration: 'none' }}>Back to log in</Link></p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}}.ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <Suspense fallback={<div style={{ color: AC.muted }}>Loading…</div>}><ResetForm /></Suspense>
      </div>
    </div>
  );
}
