'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { authApi, userApi } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { AuthBrand, AC } from '../../../components/auth-brand';

export default function VerifyPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [resent, setResent] = useState(false);
  const [mailStatus, setMailStatus] = useState<string | null>(null);
  const [checkingMail, setCheckingMail] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletionEmail, setDeletionEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const inputRefs = useRef<HTMLInputElement[]>([]);
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();

  useEffect(() => {
    let active = true;
    authApi.me()
      .then((result) => {
        if (active) setUser(result.data.data.user);
      })
      .catch((err: any) => {
        if (active && err.response?.status === 401) setSessionExpired(true);
        // The verification-email status request below reports its own errors.
      });
    authApi.verificationEmailStatus()
      .then((result) => {
        if (active) setMailStatus(result.data.data.status);
      })
      .catch((err: any) => {
        if (active && err.response?.status === 401) setSessionExpired(true);
        // Keep the verification flow usable if the status check is unavailable.
      });
    return () => { active = false; };
  }, []);

  const handleCheckMail = async () => {
    setCheckingMail(true);
    try {
      const result = await authApi.verificationEmailStatus();
      setMailStatus(result.data.data.status);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setSessionExpired(true);
        setError('Your sign-in session expired. Log in again to continue.');
      } else {
        setError('Could not check email status. You can still request a new code.');
      }
    } finally {
      setCheckingMail(false);
    }
  };

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
      await authApi.verifyOtp(code.join(''));
      if (user) setUser({ ...user, isVerified: true });
      router.push('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setSessionExpired(true);
        setError('Your sign-in session expired. Log in again, then request a fresh code if this one has expired.');
      } else {
        setError(err.response?.data?.message || 'That code didn’t match. Check it and try again.');
      }
    } finally { setLoading(false); }
  };
  const handleResend = async () => {
    setError(null);
    try {
      await authApi.resendOtp();
      setMailStatus('queued');
      setResent(true); setTimeout(() => setResent(false), 4000);
    }
    catch (err: any) {
      if (err.response?.status === 401) {
        setSessionExpired(true);
        setError('Your sign-in session expired. Log in again to continue.');
      } else {
        setError(err.response?.data?.message || 'Could not resend the code.');
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.email || deletionEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      setError('Enter your account email exactly to confirm deletion.');
      return;
    }
    if (!deletionPassword) {
      setError('Enter your current password to continue.');
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await userApi.requestAccountDeletion({ currentPassword: deletionPassword, confirmationEmail: deletionEmail });
      await logout();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not request account deletion.');
      setDeleting(false);
    }
  };

  return (
    <div className="auth-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: 'Inter, system-ui, sans-serif', background: AC.bg }}>
      <style>{`@media(max-width:860px){.auth-brand{display:none !important}.auth-grid{grid-template-columns:1fr !important}}@media(max-width:480px){.verify-grid{padding:24px !important}.otp-row{gap:8px !important;margin:22px 0 !important}.otp-input{width:clamp(34px,calc((100vw - 128px)/6),48px) !important;height:52px !important}}.ai:focus{outline:none;border-color:${AC.teal} !important;box-shadow:0 0 0 3px ${AC.tealSoft}}`}</style>
      <AuthBrand />
      <div className="verify-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ width: '100%', maxWidth: 384, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-.7px', color: AC.ink }}>Verify your email</h1>
          <p style={{ color: AC.muted, fontSize: 15, marginTop: 8 }}>Enter the 6-digit code emailed to you. It may take a moment to arrive.</p>
          {error && <div style={{ marginTop: 18, background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>{error}</div>}
          {sessionExpired && <p style={{ margin: '10px 0 0', fontSize: 14 }}><Link href="/login" style={{ color: AC.teal, fontWeight: 600 }}>Log in to continue</Link></p>}
          {mailStatus && mailStatus !== 'verified' && (
            <div role="status" aria-live="polite" style={{ marginTop: 14, color: mailStatus === 'failed' || mailStatus === 'expired' || mailStatus === 'superseded' || mailStatus === 'not_queued' ? 'var(--warning)' : AC.muted, fontSize: 13, lineHeight: 1.5 }}>
              {mailStatus === 'queued' && 'Your verification email is queued.'}
              {mailStatus === 'sending' && 'Your verification email is being sent.'}
              {mailStatus === 'retrying' && 'Email delivery had a temporary problem. We are retrying.'}
              {mailStatus === 'sent' && 'The mail provider accepted your message. Check your inbox and spam folder; inbox delivery can take a little longer.'}
              {(mailStatus === 'failed' || mailStatus === 'expired' || mailStatus === 'superseded' || mailStatus === 'not_queued') && 'There is no current verification email available. Request a new code to continue.'}
            </div>
          )}
          <div className="otp-row" style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '26px 0' }}>
            {code.map((d, i) => (
              <input key={i} ref={(el) => { if (el) inputRefs.current[i] = el; }} className="ai otp-input" aria-label={`Digit ${i + 1} of 6`} value={d} inputMode="numeric" maxLength={1}
                onChange={(e) => handleChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)}
                style={{ width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 600, borderRadius: 12, border: `1px solid ${AC.line}`, color: AC.ink }} />
            ))}
          </div>
          <button onClick={handleVerify} disabled={loading || code.includes('')} style={{ width: '100%', height: 48, borderRadius: 11, background: AC.teal, color: 'var(--btn-primary-text)', fontWeight: 600, fontSize: 15.5, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading || code.includes('') ? .55 : 1 }}>
            {loading ? 'Verifying…' : <>Verify <ArrowRight style={{ width: 17, height: 17 }} /></>}
          </button>
          <p style={{ fontSize: 14, color: AC.muted, marginTop: 18 }}>Didn&rsquo;t get it? <button onClick={handleResend} style={{ color: AC.teal, fontWeight: 600, background: 'none', border: 0, cursor: 'pointer' }}>{resent ? 'Queued!' : 'Resend code'}</button></p>
          <button type="button" onClick={handleCheckMail} disabled={checkingMail} style={{ marginTop: 2, color: AC.teal, fontSize: 13, fontWeight: 600, background: 'none', border: 0, cursor: checkingMail ? 'wait' : 'pointer' }}>{checkingMail ? 'Checking…' : 'Check email status'}</button>
          <div style={{ borderTop: `1px solid ${AC.line}`, marginTop: 30, paddingTop: 20, textAlign: 'left' }}>
            <p style={{ margin: '0 0 10px', color: AC.muted, fontSize: 13, lineHeight: 1.5 }}>If you do not want to continue, you can delete this unverified account.</p>
            {!deletionOpen ? (
              <button type="button" onClick={() => setDeletionOpen(true)} style={{ color: AC.muted, fontSize: 13, fontWeight: 600, background: 'none', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}>Delete unverified account</button>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                <p style={{ margin: 0, color: AC.muted, fontSize: 12, lineHeight: 1.5 }}>Submitting immediately signs out all sessions and disables connected accounts and automations. A background worker removes remaining account data after queued work drains and a 15-minute processing delay. That delay is not a cancellation period, and the account cannot be restored after submission. Payment transaction references may be retained without your account link.</p>
                <label htmlFor="verify-delete-password" style={{ color: AC.muted, fontSize: 12 }}>Current password</label>
                <input id="verify-delete-password" type="password" autoComplete="current-password" value={deletionPassword} onChange={(event) => setDeletionPassword(event.target.value)} style={{ height: 42, padding: '0 12px', borderRadius: 9, border: `1px solid ${AC.line}` }} />
                <label htmlFor="verify-delete-email" style={{ color: AC.muted, fontSize: 12 }}>Type {user?.email} to confirm</label>
                <input id="verify-delete-email" type="email" autoComplete="email" value={deletionEmail} onChange={(event) => setDeletionEmail(event.target.value)} style={{ height: 42, padding: '0 12px', borderRadius: 9, border: `1px solid ${AC.line}` }} />
                <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                  <button type="button" onClick={() => setDeletionOpen(false)} disabled={deleting} style={{ height: 40, padding: '0 13px', borderRadius: 9, border: `1px solid ${AC.line}`, color: AC.ink, background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                  <button type="button" onClick={handleDeleteAccount} disabled={deleting} style={{ height: 40, padding: '0 13px', borderRadius: 9, border: 0, color: 'white', background: 'var(--error)', fontWeight: 600, cursor: deleting ? 'wait' : 'pointer', opacity: deleting ? .65 : 1 }}>{deleting ? 'Requesting…' : 'Delete my account'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
