'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, AtSign, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authApi } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { AuthBrand, AC } from '../../../components/auth-brand';

export default function SignupPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    setError('');
    setLoading(true);
    try {
      await authApi.signup({ name: form.name, email: form.email, password: form.password });
      const res = await authApi.login({ email: form.email, password: form.password });
      setUser(res.data.data.user);
      router.push('/verify');
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.response?.data?.error?.message ?? 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const field = (icon: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement>, right?: React.ReactNode) => (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 14, top: 14, color: AC.muted }}>{icon}</span>
      <input className="ai" {...props} style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: `0 ${right ? 42 : 14}px 0 42px`, fontSize: 15, color: AC.ink }} />
      {right}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}}
        .ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: 384 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.8px', color: AC.ink }}>Create your account</h1>
          <p style={{ color: AC.muted, fontSize: 15, marginTop: 6 }}>Start sending reliable auto-DMs free.</p>
          {error && <div style={{ marginTop: 18, background: '#FDEBE3', color: '#B4411F', border: '1px solid #F7C7B5', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {field(<User style={{ width: 18, height: 18 }} />, { type: 'text', required: true, placeholder: 'Full name', value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) })}
            {field(<AtSign style={{ width: 18, height: 18 }} />, { type: 'email', required: true, placeholder: 'Email address', value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) })}
            {field(<Lock style={{ width: 18, height: 18 }} />, { type: showPass ? 'text' : 'password', required: true, placeholder: 'Password', value: form.password, onChange: (e) => setForm({ ...form, password: e.target.value }) },
              <button type="button" onClick={() => setShowPass((v) => !v)} aria-label="Toggle password" style={{ position: 'absolute', right: 12, top: 13, color: AC.muted, background: 'none', border: 0, cursor: 'pointer' }}>{showPass ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}</button>)}
            {field(<Lock style={{ width: 18, height: 18 }} />, { type: 'password', required: true, placeholder: 'Confirm password', value: form.confirmPassword, onChange: (e) => setForm({ ...form, confirmPassword: e.target.value }) })}
            <p style={{ fontSize: 12.5, color: AC.muted }}>At least 8 characters, with a number and a symbol.</p>
            <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 11, background: AC.teal, color: '#fff', fontWeight: 600, fontSize: 15.5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? .7 : 1 }}>
              {loading ? 'Creating…' : <>Create account <ArrowRight style={{ width: 17, height: 17 }} /></>}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 22, fontSize: 14.5, color: AC.muted }}>
            Already have an account? <Link href="/login" style={{ color: AC.teal, fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
