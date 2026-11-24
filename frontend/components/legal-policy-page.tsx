import type { ReactNode } from 'react';
import Link from 'next/link';

export function LegalPolicyPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '32px 18px 64px' }}>
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text)', fontWeight: 700, textDecoration: 'none', fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          HeyLaunch
        </Link>
        <article style={{ marginTop: 24, padding: 'clamp(24px, 5vw, 48px)', border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(34, 197, 94, 0.25)', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
            OFFICIAL POLICY · VERSION 1.0
          </div>
          <h1 style={{ margin: '18px 0 8px', fontSize: 'clamp(30px, 6vw, 42px)', lineHeight: 1.15, letterSpacing: '-1.5px', fontWeight: 800 }}>{title}</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>Effective Date: 21 November 2026 · Last Updated: 24 November 2026</p>
          <div className="legal-copy" style={{ marginTop: 32, lineHeight: 1.8, fontSize: 15 }}>{children}</div>
          <nav aria-label="Legal documents" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', borderTop: '1px solid var(--border)', marginTop: 40, paddingTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            <Link href="/terms" style={{ color: 'var(--text)', textDecoration: 'none' }}>Terms of Service</Link>
            <Link href="/privacy" style={{ color: 'var(--text)', textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/refunds" style={{ color: 'var(--text)', textDecoration: 'none' }}>Refund & Cancellation</Link>
            <Link href="/delivery" style={{ color: 'var(--text)', textDecoration: 'none' }}>Digital Delivery</Link>
            <Link href="/data-deletion" style={{ color: 'var(--text)', textDecoration: 'none' }}>User Data Deletion</Link>
            <Link href="/contact" style={{ color: 'var(--text)', textDecoration: 'none' }}>Contact & Support</Link>
          </nav>
        </article>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.35, margin: '0 0 10px', color: 'var(--text)' }}>{title}</h2>
      <div style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}
