'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, AtSign, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authApi } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { AuthBrand, AC } from '../../../components/auth-brand';
import { meetsPasswordPolicy, passwordRequirements, PASSWORD_POLICY_MESSAGE } from '../../../lib/password-policy';
import { LEGAL_POLICIES_APPROVED, PRIVACY_VERSION, TERMS_VERSION } from '../../../lib/legal-policy';

export default function SignupPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const productionSignupClosed = process.env.NODE_ENV === 'production' && !LEGAL_POLICIES_APPROVED;

  const requirements = passwordRequirements(form.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (productionSignupClosed) return setError('Sign-up is temporarily unavailable while the legal policies are finalized.');
    if (!meetsPasswordPolicy(form.password)) return setError(PASSWORD_POLICY_MESSAGE);
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (!termsAccepted || !privacyAcknowledged || !ageConfirmed) return setError('Review the policies and confirm each item before continuing.');
    setError('');
    setLoading(true);
    try {
      const res = await authApi.signup({
        name: form.name, email: form.email, password: form.password,
        termsAccepted: true, privacyAcknowledged: true, ageConfirmed: true,
        termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION,
      });
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
      <input className="ai" aria-label={typeof props.placeholder === 'string' ? props.placeholder : undefined} {...props} style={{ width: '100%', height: 48, borderRadius: 11, border: `1px solid ${AC.line}`, padding: `0 ${right ? 42 : 14}px 0 42px`, fontSize: 15, color: AC.ink }} />
      {right}
    </div>
  );

  return (
    <div className="auth-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}.auth-grid{grid-template-columns:1fr !important}}
        .ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: 384 }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.8px', color: AC.ink }}>Create your account</h1>
          <p style={{ color: AC.muted, fontSize: 15, marginTop: 6 }}>Set up Instagram comment-to-DM automation for free.</p>
          {error && <div style={{ marginTop: 18, background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
          {productionSignupClosed && <div role="status" style={{ marginTop: 18, background: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid var(--warning-soft)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>Public sign-up is closed until the Terms, Privacy, and Refund policies are approved.</div>}
          <form onSubmit={handleSubmit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {field(<User style={{ width: 18, height: 18 }} />, { type: 'text', required: true, placeholder: 'Full name', value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }) })}
            {field(<AtSign style={{ width: 18, height: 18 }} />, { type: 'email', required: true, placeholder: 'Email address', value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) })}
            {field(<Lock style={{ width: 18, height: 18 }} />, { type: showPass ? 'text' : 'password', required: true, maxLength: 128, placeholder: 'Password', autoComplete: 'new-password', 'aria-describedby': 'password-requirements', value: form.password, onChange: (e) => setForm({ ...form, password: e.target.value }) },
              <button type="button" onClick={() => setShowPass((v) => !v)} aria-label="Toggle password" style={{ position: 'absolute', right: 12, top: 13, color: AC.muted, background: 'none', border: 0, cursor: 'pointer' }}>{showPass ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}</button>)}
            {field(<Lock style={{ width: 18, height: 18 }} />, { type: 'password', required: true, maxLength: 128, placeholder: 'Confirm password', autoComplete: 'new-password', value: form.confirmPassword, onChange: (e) => setForm({ ...form, confirmPassword: e.target.value }) })}
            <ul id="password-requirements" aria-label="Password requirements" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', margin: '-2px 0 0', padding: 0, listStyle: 'none', fontSize: 12, color: AC.muted }}>
              {requirements.map((requirement) => (
                <li key={requirement.label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: requirement.met ? 'var(--success)' : AC.muted }}>
                  <span aria-hidden="true">{requirement.met ? '✓' : '•'}</span>{requirement.label}
                </li>
              ))}
            </ul>
            <div style={{ display: 'grid', gap: 10, margin: '3px 0', color: AC.muted, fontSize: 12.5, lineHeight: 1.5 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
                <input type="checkbox" required checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ marginTop: 3, accentColor: AC.teal }} />
                <span>I agree to the draft <Link href="/terms">Terms of Service</Link>.</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
                <input type="checkbox" required checked={privacyAcknowledged} onChange={(e) => setPrivacyAcknowledged(e.target.checked)} style={{ marginTop: 3, accentColor: AC.teal }} />
                <span>I have read the draft <Link href="/privacy">Privacy Notice</Link>.</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
                <input type="checkbox" required checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} style={{ marginTop: 3, accentColor: AC.teal }} />
                <span>I confirm that I am at least 18 years old.</span>
              </label>
            </div>
            <button type="submit" disabled={loading || productionSignupClosed} style={{ height: 48, borderRadius: 11, background: AC.teal, color: 'var(--btn-primary-text)', fontWeight: 600, fontSize: 15.5, border: 0, cursor: productionSignupClosed ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading || productionSignupClosed ? .7 : 1 }}>
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
