'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ShieldPlus } from 'lucide-react';
import { authApi, adminApi } from '../../../services/api';
import { Btn, Card, Spinner } from '../../../components/rl-kit';
import { useAuthStore } from '../../../store/authStore';

type InviteAccount = { id: string; email: string; isVerified?: boolean; role: string };

export default function AdminInvitationPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [token, setToken] = useState('');
  const [account, setAccount] = useState<InviteAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
    authApi.me().then((response) => setAccount(response.data.data.user as InviteAccount)).catch(() => setAccount(null)).finally(() => setLoading(false));
  }, []);

  async function accept() {
    setAccepting(true); setError('');
    try {
      await adminApi.acceptAdminInvitation(token);
      setUser(null);
      router.replace('/login?adminInvite=accepted');
    } catch (cause: any) {
      setError(cause?.response?.data?.message || 'This invitation could not be accepted. Check that it is current and that you are signed in with its invited email.');
    } finally {
      setAccepting(false);
    }
  }

  async function refreshSession() {
    setLoading(true); setError('');
    try { setAccount((await authApi.me()).data.data.user as InviteAccount); }
    catch { setAccount(null); }
    finally { setLoading(false); }
  }

  const tokenValid = /^[A-Za-z0-9_-]{43}$/.test(token);
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--bg)' }}>
    <Card style={{ width: 'min(100%,500px)', padding: 30 }}>
      <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 14, color: 'var(--accent)', background: 'var(--accent-soft)', marginBottom: 18 }}>
        <ShieldPlus aria-hidden style={{ width: 25, height: 25 }} />
      </div>
      <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 24, letterSpacing: '-.5px' }}>HeyLaunch admin invitation</h1>
      <p style={{ margin: '10px 0 22px', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
        Accept only if you expected this invitation. It is single-use, expires after seven days, and grants only the access configured by the inviter.
      </p>
      {!tokenValid && !loading && <p role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>This invitation link is missing or malformed.</p>}
      {loading ? <div style={{ display: 'grid', justifyItems: 'center', gap: 12, padding: 20 }}><Spinner /><span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Checking your HeyLaunch session…</span></div>
        : account ? <>
          <div style={{ padding: 13, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13 }}>
            Signed in as <strong style={{ color: 'var(--text)' }}>{account.email}</strong>
          </div>
          {!account.isVerified && <p role="alert" style={{ color: 'var(--warning)', fontSize: 13 }}>Verify this account’s email first, then reopen this invitation.</p>}
          {error && <p role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>}
          <Btn variant="accent" loading={accepting} disabled={!tokenValid || !account.isVerified} onClick={accept} style={{ width: '100%', marginTop: 16 }}>
            <ShieldCheck style={{ width: 16, height: 16 }} aria-hidden /> Accept invitation
          </Btn>
          <p style={{ margin: '14px 0 0', color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.5 }}>
            After accepting, your current session is revoked. Sign in again and enroll an authenticator before using admin tools.
          </p>
        </> : <>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
            Sign in or create an account with the invited email address. If you sign up, verify that email first, then return to this invitation link.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
            <Link href="/login" target="_blank" rel="noreferrer" style={{ textAlign: 'center', padding: 12, borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none', fontSize: 13 }}>Sign in</Link>
            <Link href="/signup" target="_blank" rel="noreferrer" style={{ textAlign: 'center', padding: 12, borderRadius: 9, background: 'var(--text)', color: 'var(--bg)', textDecoration: 'none', fontSize: 13 }}>Create account</Link>
          </div>
          <button type="button" onClick={refreshSession} style={{ display: 'block', margin: '14px auto 0', padding: 8, border: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>
            I’m signed in — check this invitation
          </button>
        </>}
      <div style={{ marginTop: 24, textAlign: 'center' }}><Link href="/" style={{ color: 'var(--text-faint)', fontSize: 12, textDecoration: 'none' }}>Return to HeyLaunch</Link></div>
    </Card>
  </main>;
}
