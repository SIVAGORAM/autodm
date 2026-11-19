'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { automationApi } from '../../../../services/api';
import { RL, Card, Stat, Pill, Empty, Skel, PageHead } from '../../../../components/rl-kit';
import { BarChart2, Send, Zap, Activity, MousePointerClick, ArrowRight } from 'lucide-react';

type Automation = {
  id: string; name: string; status: string; triggerType: string;
  _count?: { runs: number }; health?: { level: string; label: string };
};
const healthTone = (l?: string) => l === 'healthy' ? 'green' : l === 'needs_reconnect' ? 'coral' : l === 'at_risk' ? 'amber' : 'muted';
const statusTone = (s: string) => s === 'LIVE' ? 'green' : s === 'PAUSED' ? 'amber' : 'muted';

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['automations'], queryFn: async () => (await automationApi.list()).data.data as Automation[] });
  const list = data ?? [];
  const totalRuns = list.reduce((s, a) => s + (a._count?.runs ?? 0), 0);
  const live = list.filter((a) => a.status === 'LIVE').length;
  const topRuns = Math.max(1, ...list.map((a) => a._count?.runs ?? 0));

  return (
    <div>
      <PageHead title="Analytics" sub="How your automations are performing. Open any automation for its full click-through and delivery breakdown." />

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>{[0, 1, 2].map((i) => <Skel key={i} h={112} />)}</div>
      ) : list.length === 0 ? (
        <Empty icon={<BarChart2 style={{ width: 24, height: 24 }} />} title="Nothing to measure yet" sub="Create an automation and send your first DMs — your performance will appear here." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
            <Stat label="Total DMs sent" value={totalRuns.toLocaleString()} delta="across all automations" icon={<Send style={{ width: 18, height: 18 }} />} />
            <Stat label="Automations" value={list.length} delta={`${live} live`} icon={<Zap style={{ width: 18, height: 18 }} />} />
            <Stat label="Live now" value={live} delta={live ? 'sending in real time' : 'none live'} icon={<Activity style={{ width: 18, height: 18 }} />} />
          </div>

          <h2 style={{ fontSize: 17, fontWeight: 700, color: RL.ink, margin: '0 0 14px' }}>Performance by automation</h2>
          <Card pad={0}>
            {list.map((a, i) => {
              const runs = a._count?.runs ?? 0;
              return (
                <Link key={a.id} href={`/dashboard/automations/${a.id}`}
                  style={{ display: 'grid', gridTemplateColumns: '1.6fr 2fr auto', gap: 16, alignItems: 'center', padding: '16px 20px', textDecoration: 'none', borderBottom: i < list.length - 1 ? `1px solid ${RL.lineSoft}` : 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 650, color: RL.ink }}>{a.name}</span>
                      <Pill tone={statusTone(a.status)}>{a.status.toLowerCase()}</Pill>
                    </div>
                    {a.health && <div style={{ marginTop: 5 }}><Pill tone={healthTone(a.health.level)} dot>{a.health.label}</Pill></div>}
                  </div>
                  <div>
                    <div style={{ height: 8, borderRadius: 999, background: RL.softer, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(runs / topRuns) * 100}%`, background: RL.teal, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 12, color: RL.muted, marginTop: 5 }}>{runs.toLocaleString()} DMs sent</div>
                  </div>
                  <ArrowRight style={{ width: 17, height: 17, color: RL.faint }} />
                </Link>
              );
            })}
          </Card>
          <p style={{ fontSize: 13, color: RL.muted, marginTop: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
            <MousePointerClick style={{ width: 15, height: 15 }} /> Click-through rates and per-run detail live inside each automation.
          </p>
        </>
      )}
    </div>
  );
}
