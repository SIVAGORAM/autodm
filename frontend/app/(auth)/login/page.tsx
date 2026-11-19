'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AtSign, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authApi } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { AuthBrand, AC } from '../../../components/auth-brand';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(form);
      setUser(res.data.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.response?.data?.error?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}.auth-grid{grid-template-columns:1fr !important}}
        .ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: 384 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.8px', color: AC.ink }}>Welcome back</h1>
          <p style={{ color: AC.muted, fontSize: 15, marginTop: 6 }}>Log in to your Relayo dashboard.</p>
          {error && <div style={{ marginTop: 18, background: '#FDEBE3', color: '#B4411F', border: '1px solid #F7C7B5', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <AtSign style={{ position: 'absolute', left: 14, top: 14, width: 18, height: 18, color: AC.muted }} />
              <input className="ai" type="email" required placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 14px 0 42px', fontSize: 15, color: AC.ink }} />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: 14, top: 14, width: 18, height: 18, color: AC.muted }} />
              <input className="ai" type={showPassword ? 'text' : 'password'} required placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 42px 0 42px', fontSize: 15, color: AC.ink }} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password" style={{ position: 'absolute', right: 12, top: 13, color: AC.muted, background: 'none', border: 0, cursor: 'pointer' }}>
                {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link href="/forgot-password" style={{ fontSize: 13.5, color: AC.teal, textDecoration: 'none' }}>Forgot password?</Link>
            </div>
            <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 11, background: AC.teal, color: '#fff', fontWeight: 600, fontSize: 15.5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? .7 : 1 }}>
              {loading ? 'Signing in…' : <>Sign in <ArrowRight style={{ width: 17, height: 17 }} /></>}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14.5, color: AC.muted }}>
            New to Relayo? <Link href="/signup" style={{ color: AC.teal, fontWeight: 600, textDecoration: 'none' }}>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
