'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { AtSign, Lock, Eye, EyeOff, ArrowRight, Copy, Check, ShieldCheck, Smartphone, Key, ArrowLeft } from 'lucide-react';
import { api, authApi, getApiErrorMessage } from '../../../services/api';
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
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Pre-warm backend container while user enters credentials
  useEffect(() => {
    void api.get('/version').catch(() => undefined);
  }, []);

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
      if (res.data?.data?.mfaSetupRequired) {
        setAdminStep('setup');
        setError('');
        // Immediately fetch setup data and generate QR code
        try {
          const mfaRes = await authApi.beginAdminMfaSetup(form.password);
          setMfaSetup(mfaRes.data.data);
          if (mfaRes.data.data.otpauthUri) {
            const url = await QRCode.toDataURL(mfaRes.data.data.otpauthUri, {
              width: 260,
              margin: 2,
              color: { dark: '#17171B', light: '#ffffff' },
            });
            setQrCodeUrl(url);
          }
        } catch {
          // Fall back to manual button if automatic start fails
        }
      } else if (res.data?.data?.mfaRequired) {
        setAdminStep('verify');
        setUseRecoveryCode(false);
        setError('');
      } else if (res.data?.data?.user) {
        setUser(res.data.data.user);
        router.replace('/dashboard');
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
      if (response.data.data.otpauthUri) {
        const url = await QRCode.toDataURL(response.data.data.otpauthUri, {
          width: 260,
          margin: 2,
          color: { dark: '#17171B', light: '#ffffff' },
        });
        setQrCodeUrl(url);
      }
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
          {adminStep === 'verify' && (
            <div style={{ width: 44, height: 44, borderRadius: 12, background: AC.tealSoft, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <ShieldCheck style={{ width: 22, height: 22, color: AC.teal }} />
            </div>
          )}
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.8px', color: AC.ink }}>{adminStep === 'credentials' ? 'Welcome back' : adminStep === 'setup' ? 'Secure your account' : adminStep === 'verify' ? 'Two-factor verification' : 'Save your recovery codes'}</h1>
          <p style={{ color: AC.muted, fontSize: 15, marginTop: 6 }}>{adminStep === 'credentials' ? 'Log in to your HeyLaunch dashboard.' : adminStep === 'setup' ? 'Set up an authenticator to finish account sign-in.' : adminStep === 'verify' ? (useRecoveryCode ? 'Enter one of your emergency recovery codes to sign in.' : 'Enter the 6-digit code from your authenticator app.') : 'Each recovery code works once. Store them somewhere private.'}</p>
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
          </form> : adminStep === 'setup' ? <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
            {!mfaSetup ? (
              <button type="button" onClick={startMfaSetup} disabled={loading} style={{ height: 46, borderRadius: 10, background: AC.teal, color: 'white', fontWeight: 650, border: 0, cursor: 'pointer' }}>
                {loading ? 'Preparing…' : 'Set up authenticator'}
              </button>
            ) : (
              <>
                <div style={{ background: '#ffffff', border: `1px solid ${AC.line}`, borderRadius: 14, padding: 18, textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="Scan QR code in Authenticator App" style={{ width: 190, height: 190, margin: '0 auto', display: 'block', borderRadius: 8 }} />
                  ) : (
                    <div style={{ width: 190, height: 190, margin: '0 auto', display: 'grid', placeItems: 'center', color: AC.muted, fontSize: 13 }}>
                      Loading QR code…
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: AC.muted, marginTop: 10, lineHeight: 1.4 }}>
                    Scan with <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or <strong>1Password</strong>.
                  </p>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowManualKey((v) => !v)}
                    style={{ background: 'none', border: 0, color: AC.teal, fontSize: 13, fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {showManualKey ? 'Hide manual setup key' : "Can't scan? Use manual setup key"}
                  </button>
                  {showManualKey && (
                    <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'var(--surface)', border: `1px solid ${AC.line}`, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11.5, color: AC.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Secret Key</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (mfaSetup?.secret) {
                              navigator.clipboard.writeText(mfaSetup.secret);
                              setCopiedKey(true);
                              setTimeout(() => setCopiedKey(false), 2000);
                            }
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 0, color: AC.teal, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                        >
                          {copiedKey ? <><Check style={{ width: 13, height: 13 }} /> Copied</> : <><Copy style={{ width: 13, height: 13 }} /> Copy</>}
                        </button>
                      </div>
                      <code style={{ display: 'block', color: AC.ink, overflowWrap: 'anywhere', fontSize: 13.5, fontFamily: 'monospace' }}>
                        {mfaSetup.secret}
                      </code>
                    </div>
                  )}
                </div>

                <form onSubmit={verifyMfa} style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', color: AC.ink, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      6-Digit Authenticator Code
                    </label>
                    <input
                      className="ai"
                      aria-label="Authenticator code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      style={{
                        width: '100%',
                        height: 50,
                        borderRadius: 11,
                        border: `1px solid ${AC.line}`,
                        padding: '0 14px',
                        fontSize: 22,
                        textAlign: 'center',
                        letterSpacing: 6,
                        fontWeight: 700,
                        color: AC.ink,
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || mfaCode.trim().length < 6}
                    style={{
                      height: 48,
                      borderRadius: 11,
                      background: AC.teal,
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 15,
                      border: 0,
                      cursor: 'pointer',
                      opacity: loading || mfaCode.trim().length < 6 ? 0.7 : 1,
                    }}
                  >
                    {loading ? 'Verifying…' : 'Confirm and continue'}
                  </button>
                </form>
              </>
            )}
          </div> : adminStep === 'verify' ? (
            <form onSubmit={verifyMfa} style={{ marginTop: 22, display: 'grid', gap: 14 }}>
              {!useRecoveryCode ? (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: AC.ink, marginBottom: 8 }}>
                    6-Digit Authenticator Code
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Smartphone style={{ position: 'absolute', left: 14, top: 15, width: 18, height: 18, color: AC.muted, pointerEvents: 'none' }} />
                    <input
                      className="ai"
                      aria-label="6-digit authenticator code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      autoFocus
                      required
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      style={{
                        width: '100%',
                        height: 50,
                        borderRadius: 11,
                        border: `1px solid ${AC.line}`,
                        padding: '0 16px 0 44px',
                        fontSize: 22,
                        letterSpacing: '6px',
                        fontWeight: 700,
                        color: AC.ink,
                        background: '#ffffff',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: AC.ink, marginBottom: 8 }}>
                    Emergency Recovery Code
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Key style={{ position: 'absolute', left: 14, top: 15, width: 18, height: 18, color: AC.muted, pointerEvents: 'none' }} />
                    <input
                      className="ai"
                      aria-label="Emergency recovery code"
                      autoComplete="one-time-code"
                      maxLength={32}
                      autoFocus
                      required
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value.trim())}
                      placeholder="e.g. 4a2b-9c1d-8e"
                      style={{
                        width: '100%',
                        height: 50,
                        borderRadius: 11,
                        border: `1px solid ${AC.line}`,
                        padding: '0 16px 0 44px',
                        fontSize: 16,
                        fontWeight: 600,
                        color: AC.ink,
                        background: '#ffffff',
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || mfaCode.trim().length === 0}
                style={{
                  height: 48,
                  borderRadius: 11,
                  background: AC.teal,
                  color: 'white',
                  fontWeight: 600,
                  fontSize: 15.5,
                  border: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: loading || mfaCode.trim().length === 0 ? 0.7 : 1,
                  transition: 'opacity 0.15s ease',
                }}
              >
                {loading ? 'Verifying…' : <>Verify and sign in <ArrowRight style={{ width: 17, height: 17 }} /></>}
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode((v) => !v);
                    setMfaCode('');
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 0,
                    color: AC.teal,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {useRecoveryCode ? 'Use 6-digit authenticator code instead' : 'Lost your phone? Use an emergency recovery code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAdminStep('credentials');
                    setMfaCode('');
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 0,
                    color: AC.muted,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <ArrowLeft style={{ width: 14, height: 14 }} /> Back to log in
                </button>
              </div>
            </form>
          ) : <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
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
