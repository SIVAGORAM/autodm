'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { paymentApi } from '../services/api';
import { RL } from './rl-kit';
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

  const bg = urgent ? RL.coral : RL.ink;
  const accent = urgent ? '#FFD9C9' : RL.tealSoft;

  return (
    <div style={{ background: bg, color: '#fff', padding: '10px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
        <Clock className={urgent ? 'rl-live' : undefined} style={{ width: 17, height: 17 }} />
        <span style={{ fontWeight: 600 }}>
          {urgent ? 'Your free trial is almost over —' : 'Free trial active — full Pro access.'}
        </span>
        <span style={{ color: accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{left} left</span>
      </div>
      <Link href="/dashboard/billing" className="rl-b" style={{ background: '#fff', color: urgent ? RL.coral : RL.ink, padding: '7px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Sparkles style={{ width: 14, height: 14 }} /> Upgrade to Pro
      </Link>
    </div>
  );
}
