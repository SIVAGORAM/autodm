import type { ReactNode } from 'react';
import Link from 'next/link';
import { LEGAL_POLICIES_APPROVED } from '../lib/legal-policy';

export function LegalPolicyPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '32px 18px 64px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text)', fontWeight: 700, textDecoration: 'none' }}>HeyLaunch</Link>
        <article style={{ marginTop: 28, padding: 'clamp(22px, 5vw, 48px)', border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid var(--warning-soft)', background: 'var(--warning-soft)', color: 'var(--warning)', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>
            {LEGAL_POLICIES_APPROVED ? 'CURRENT POLICY' : 'DRAFT — OWNER REVIEW REQUIRED'}
          </div>
          <h1 style={{ margin: '18px 0 8px', fontSize: 'clamp(30px, 6vw, 42px)', lineHeight: 1.1, letterSpacing: '-1.5px' }}>{title}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>{LEGAL_POLICIES_APPROVED ? 'Current policy version 1 · Effective date to be set by the operator' : 'Draft version 1 · Prepared 21 November 2026 · Not approved for public launch'}</p>
          <div className="legal-copy" style={{ marginTop: 30, lineHeight: 1.75, fontSize: 15 }}>{children}</div>
          <nav aria-label="Legal documents" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--border)', marginTop: 36, paddingTop: 18, fontSize: 13 }}>
            <Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refunds">Refunds</Link>
          </nav>
        </article>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section style={{ marginTop: 24 }}><h2 style={{ fontSize: 19, lineHeight: 1.3, margin: '0 0 8px' }}>{title}</h2><div style={{ color: 'var(--text-muted)' }}>{children}</div></section>;
}
