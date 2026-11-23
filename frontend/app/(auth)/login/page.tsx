'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AtSign, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authApi, getApiErrorMessage } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { AuthBrand, AC } from '../../../components/auth-brand';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [adminStep, setAdminStep] = useState<'credentials' | 'setup' | 'verify' | 'recovery'>('credentials');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Confirm the browser can use the HTTP-only session cookies before entering
  // the protected dashboard. This catches proxy/cookie configuration problems
  // on the sign-in screen instead of showing a successful login then bouncing.
  const confirmBrowserSession = async () => {
    setLoading(true);
    try {
      const response = await authApi.me();
      setUser(response.data.data.user);
      router.replace('/dashboard');
    } catch {
      setError('Your sign-in was accepted, but HeyLaunch could not verify the browser session. Check the site/API deployment and cookie settings, then try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(form);
      if (res.data.data.mfaSetupRequired) {
        setAdminStep('setup');
        setError('Administrator accounts must enroll an authenticator before opening the dashboard.');
      } else if (res.data.data.mfaRequired) {
        setAdminStep('verify');
        setError('Enter the code from your authenticator app or a recovery code.');
      } else {
        await confirmBrowserSession();
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Login failed. Check your email and password, then try again.'));
    } finally {
      setLoading(false);
    }
  };

  const startMfaSetup = async () => {
    setError(''); setLoading(true);
    try {
      const response = await authApi.beginAdminMfaSetup(form.password);
      setMfaSetup(response.data.data);
      setError('Add this secret to an authenticator app, then enter the generated six-digit code.');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not start administrator MFA setup. Sign in again.'));
      if (err.response?.status === 401) setAdminStep('credentials');
    } finally { setLoading(false); }
  };

  const verifyMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      if (adminStep === 'setup') {
        const response = await authApi.confirmAdminMfaSetup(mfaCode.trim());
        setRecoveryCodes(response.data.data.recoveryCodes ?? []);
        setAdminStep('recovery');
      } else {
        await authApi.verifyAdminMfa(mfaCode.trim());
        await confirmBrowserSession();
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'MFA verification failed. Check the code and try again.'));
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}.auth-grid{grid-template-columns:1fr !important}}
        .ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: 384 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.8px', color: AC.ink }}>{adminStep === 'credentials' ? 'Welcome back' : adminStep === 'setup' ? 'Secure your admin account' : adminStep === 'verify' ? 'Administrator verification' : 'Save your recovery codes'}</h1>
          <p style={{ color: AC.muted, fontSize: 15, marginTop: 6 }}>{adminStep === 'credentials' ? 'Log in to your HeyLaunch dashboard.' : adminStep === 'setup' ? 'Set up an authenticator to finish administrator sign-in.' : adminStep === 'verify' ? 'Your admin account requires a second factor.' : 'Each recovery code works once. Store them somewhere private.'}</p>
          {error && <div style={{ marginTop: 18, background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
          {adminStep === 'credentials' ? <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <AtSign style={{ position: 'absolute', left: 14, top: 14, width: 18, height: 18, color: AC.muted }} />
              <input className="ai" aria-label="Email address" type="email" required placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 14px 0 42px', fontSize: 15, color: AC.ink }} />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: 14, top: 14, width: 18, height: 18, color: AC.muted }} />
              <input className="ai" aria-label="Password" type={showPassword ? 'text' : 'password'} required placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 42px 0 42px', fontSize: 15, color: AC.ink }} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password" style={{ position: 'absolute', right: 12, top: 13, color: AC.muted, background: 'none', border: 0, cursor: 'pointer' }}>
                {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link href="/forgot-password" style={{ fontSize: 13.5, color: AC.teal, textDecoration: 'none' }}>Forgot password?</Link>
            </div>
            <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 11, background: AC.teal, color: 'var(--btn-primary-text)', fontWeight: 600, fontSize: 15.5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? .7 : 1 }}>
              {loading ? 'Signing in…' : <>Sign in <ArrowRight style={{ width: 17, height: 17 }} /></>}
            </button>
          </form> : adminStep === 'setup' ? <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
            {!mfaSetup ? <button type="button" onClick={startMfaSetup} disabled={loading} style={{ height: 46, borderRadius: 10, background: AC.teal, color: 'white', fontWeight: 650, border: 0, cursor: 'pointer' }}>{loading ? 'Preparing…' : 'Set up authenticator'}</button> : <>
              <div style={{ padding: 14, borderRadius: 10, background: 'var(--surface)', border: `1px solid ${AC.line}` }}>
                <label style={{ display: 'block', color: AC.muted, fontSize: 12, marginBottom: 7 }}>Manual setup key</label>
                <code style={{ display: 'block', color: AC.ink, overflowWrap: 'anywhere', fontSize: 14 }}>{mfaSetup.secret}</code>
                <a href={mfaSetup.otpauthUri} style={{ display: 'inline-block', marginTop: 10, color: AC.teal, fontSize: 13 }}>Open in authenticator app</a>
              </div>
              <form onSubmit={verifyMfa} style={{ display: 'grid', gap: 12 }}>
                <input className="ai" aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={32} required value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="6-digit authenticator code" style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 14px', fontSize: 15, color: AC.ink }} />
                <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 11, background: AC.teal, color: 'white', fontWeight: 600, border: 0, cursor: 'pointer' }}>{loading ? 'Verifying…' : 'Confirm and continue'}</button>
              </form>
            </>}
          </div> : adminStep === 'verify' ? <form onSubmit={verifyMfa} style={{ marginTop: 22, display: 'grid', gap: 12 }}>
            <input className="ai" aria-label="Authenticator or recovery code" autoComplete="one-time-code" maxLength={32} required value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="Authenticator or recovery code" style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: '0 14px', fontSize: 15, color: AC.ink }} />
            <button type="submit" disabled={loading} style={{ height: 48, borderRadius: 11, background: AC.teal, color: 'white', fontWeight: 600, border: 0, cursor: 'pointer' }}>{loading ? 'Verifying…' : 'Verify and sign in'}</button>
          </form> : <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
            <div style={{ padding: 14, border: `1px solid ${AC.line}`, borderRadius: 10, background: 'var(--surface)', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
              {recoveryCodes.map((code) => <code key={code} style={{ color: AC.ink, fontSize: 13 }}>{code}</code>)}
            </div>
            <button type="button" disabled={loading} onClick={() => void confirmBrowserSession()} style={{ height: 48, borderRadius: 11, background: AC.teal, color: 'white', fontWeight: 600, border: 0, cursor: loading ? 'wait' : 'pointer', opacity: loading ? .7 : 1 }}>I saved these codes — continue</button>
          </div>}
          {adminStep === 'credentials' && <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14.5, color: AC.muted }}>
            New to HeyLaunch? <Link href="/signup" style={{ color: AC.teal, fontWeight: 600, textDecoration: 'none' }}>Create an account</Link>
          </p>}
        </div>
      </div>
    </div>
  );
}
