'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { AuthBrand, AC } from '../../../components/auth-brand';

export default function VerifyPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const inputRefs = useRef<HTMLInputElement[]>([]);
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const handleChange = (i: number, v: string) => {
    if (!/^[0-9]?$/.test(v)) return;
    const next = [...code]; next[i] = v; setCode(next);
    if (v && i < 5) inputRefs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };
  const handleVerify = async () => {
    setLoading(true); setError(null);
    try {
      await api.post('/auth/verify-otp', { code: code.join('') });
      if (user) setUser({ ...user, isVerified: true });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'That code didn’t match. Check it and try again.');
    } finally { setLoading(false); }
  };
  const handleResend = async () => {
    setError(null);
    try { await api.post('/auth/resend-otp'); setResent(true); setTimeout(() => setResent(false), 4000); }
    catch (err: any) { setError(err.response?.data?.message || 'Could not resend the code.'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}}.ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: 384, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.7px', color: AC.ink }}>Verify your email</h1>
          <p style={{ color: AC.muted, fontSize: 15, marginTop: 8 }}>Enter the 6-digit code we sent to secure your account.</p>
          {error && <div style={{ marginTop: 18, background: '#FDEBE3', color: '#B4411F', border: '1px solid #F7C7B5', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '26px 0' }}>
            {code.map((d, i) => (
              <input key={i} ref={(el) => { if (el) inputRefs.current[i] = el; }} className="ai" value={d} inputMode="numeric" maxLength={1}
                onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                style={{ width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 600, borderRadius: 12, border: `1px solid ${AC.line}`, color: AC.ink }} />
            ))}
          </div>
          <button onClick={handleVerify} disabled={loading || code.includes('')} style={{ width: '100%', height: 48, borderRadius: 11, background: AC.teal, color: '#fff', fontWeight: 600, fontSize: 15.5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading || code.includes('') ? .55 : 1 }}>
            {loading ? 'Verifying…' : <>Verify <ArrowRight style={{ width: 17, height: 17 }} /></>}
          </button>
          <p style={{ fontSize: 14, color: AC.muted, marginTop: 18 }}>Didn&rsquo;t get it? <button onClick={handleResend} style={{ color: AC.teal, fontWeight: 600, background: 'none', border: 0, cursor: 'pointer' }}>{resent ? 'Sent!' : 'Resend code'}</button></p>
        </div>
      </div>
    </div>
  );
}
