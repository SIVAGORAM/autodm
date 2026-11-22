'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { LegalPolicyPage } from '../../../components/legal-policy-page';
import { LEGAL_POLICIES_APPROVED, PRIVACY_VERSION, TERMS_VERSION } from '../../../lib/legal-policy';

export default function AcceptPoliciesPage() {
  const router = useRouter();
  const { user, isAuthenticated, isFetched, fetchMe } = useAuthStore();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFetched) fetchMe().catch(() => router.replace('/login'));
  }, [fetchMe, isFetched, router]);

  useEffect(() => {
    if (isFetched && !isAuthenticated) router.replace('/login');
    if (isFetched && isAuthenticated && (!LEGAL_POLICIES_APPROVED ||
      (user?.termsVersion === TERMS_VERSION && user?.privacyVersion === PRIVACY_VERSION))) {
      router.replace('/dashboard');
    }
  }, [isFetched, isAuthenticated, user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!termsAccepted || !privacyAcknowledged || !ageConfirmed) {
      setError('Please confirm each item to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authApi.acceptLegalPolicies({
        termsAccepted: true,
        privacyAcknowledged: true,
        ageConfirmed: true,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      });
      await fetchMe();
      router.replace('/dashboard');
    } catch {
      setError('We could not save your acknowledgment. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <LegalPolicyPage title="Review updated policies">
    <p>Your continued use of HeyLaunch requires acknowledgment of the current Terms and Privacy Notice. Please review both documents before continuing.</p>
    <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 24 }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
        <span>I agree to the <Link href="/terms">Terms of Service</Link>.</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input type="checkbox" required checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} />
        <span>I have read the <Link href="/privacy">Privacy Notice</Link>.</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input type="checkbox" required checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} />
        <span>I confirm that I am at least 18 years old.</span>
      </label>
      {error && <p role="alert" style={{ margin: 0, color: 'var(--error)' }}>{error}</p>}
      <button type="submit" disabled={busy} style={{ minHeight: 44, border: 0, borderRadius: 10, background: 'var(--lime)', color: 'var(--on-lime)', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? .65 : 1 }}>
        {busy ? 'Saving…' : 'Accept and continue'}
      </button>
    </form>
  </LegalPolicyPage>;
}
