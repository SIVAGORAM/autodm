'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { paymentApi } from '../services/api';
import { Sparkles, Clock } from 'lucide-react';

type Sub = { plan: string; active: boolean; isPaid: boolean; trial: { active: boolean; endsAt: string | null } };

export function TrialBanner() {
  const sub = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => (await paymentApi.getSubscription()).data.data as Sub,
    refetchInterval: 60_000, // re-sync with server every minute
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const trial = sub.data?.trial;
  if (sub.data?.isPaid) return null;            // already Pro → no banner
  if (!trial?.active || !trial.endsAt) return null; // no active trial → no banner

  const ms = new Date(trial.endsAt).getTime() - now;
  if (ms <= 0) return null; // expired → server already treats them as Free

  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const left = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  const urgent = ms < 6 * 3_600_000; // last 6 hours → urgent

  // Signature lime strip for a growth action; amber when it's running out.
  // Both are theme-stable with dark on-lime text (readable in light AND dark).
  const bg = urgent ? 'var(--warning)' : 'var(--lime)';

  return (
    <div style={{ background: bg, color: 'var(--on-lime)', padding: '10px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
        <Clock className={urgent ? 'rl-live' : undefined} style={{ width: 17, height: 17 }} aria-hidden />
        <span style={{ fontWeight: 600 }}>
          {urgent ? 'Your free trial is almost over —' : 'Free trial active — full Pro access.'}
        </span>
        <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{left} left</span>
      </div>
      <Link href="/dashboard/billing" className="rl-b" style={{ height: 34, background: 'var(--btn-primary)', color: 'var(--btn-primary-text)', padding: '0 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Sparkles style={{ width: 14, height: 14 }} aria-hidden /> Upgrade to Pro
      </Link>
    </div>
  );
}
