'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';
import { authApi } from '../../../services/api';
import { AuthBrand, AC } from '../../../components/auth-brand';
import { meetsPasswordPolicy, passwordRequirements, PASSWORD_POLICY_MESSAGE } from '../../../lib/password-policy';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requirements = passwordRequirements(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetsPasswordPolicy(password)) return setError(PASSWORD_POLICY_MESSAGE);
    if (password !== confirmPassword) return setError('Passwords do not match');
    setLoading(true); setError(null);
    try { await authApi.resetPassword({ token: token ?? '', password }); router.push('/login'); }
    catch (err: any) { setError(err.response?.data?.message || 'This reset link is invalid or expired.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ width: '100%', maxWidth: 384 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.7px', color: AC.ink }}>Set a new password</h1>
      <p style={{ color: AC.muted, fontSize: 15, marginTop: 8 }}>Choose a strong password you don&rsquo;t use elsewhere.</p>
      {error && <div style={{ marginTop: 18, background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[['New password', password, setPassword], ['Confirm new password', confirmPassword, setConfirmPassword]].map(([ph, val, set]: any) => (
          <div key={ph} style={{ position: 'relative' }}>
            <Lock style={{ position: 'absolute', left: 14, top: 14, width: 18, height: 18, color: AC.muted }} />
            <input className="ai" aria-label={ph} type="password" required maxLength={128} autoComplete="new-password" aria-describedby={ph === 'New password' ? 'password-requirements' : undefined} placeholder={ph} value={val} onChange={(e) => set(e.target.value)}
              style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 14px 0 42px', fontSize: 15, color: AC.ink }} />
          </div>
        ))}
        <ul id="password-requirements" aria-label="Password requirements" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', margin: '-2px 0 0', padding: 0, listStyle: 'none', fontSize: 12, color: AC.muted }}>
          {requirements.map((requirement) => (
            <li key={requirement.label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: requirement.met ? 'var(--success)' : AC.muted }}>
              <span aria-hidden="true">{requirement.met ? '✓' : '•'}</span>{requirement.label}
            </li>
          ))}
        </ul>
        <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 11, background: AC.teal, color: 'var(--btn-primary-text)', fontWeight: 600, fontSize: 15.5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? .7 : 1 }}>
          {loading ? 'Updating…' : <>Update password <ArrowRight style={{ width: 17, height: 17 }} /></>}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: 22, fontSize: 14.5, color: AC.muted }}><Link href="/login" style={{ color: AC.teal, fontWeight: 600, textDecoration: 'none' }}>Back to log in</Link></p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}.auth-grid{grid-template-columns:1fr !important}}.ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <Suspense fallback={<div style={{ color: AC.muted }}>Loading…</div>}><ResetForm /></Suspense>
      </div>
    </div>
  );
}
