'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { automationApi } from '../../../../services/api';
import { RL, Card, Stat, Pill, Empty, Skel, PageHead, Btn } from '../../../../components/rl-kit';
import { BarChart2, Send, Zap, Activity, MousePointerClick, ArrowRight } from 'lucide-react';

type Automation = {
  id: string; name: string; status: string; triggerType: string;
  sentCount?: number; _count?: { runs: number }; health?: { level: string; label: string };
};
const healthTone = (l?: string) => l === 'healthy' ? 'green' : l === 'needs_reconnect' ? 'coral' : l === 'at_risk' ? 'amber' : 'muted';
const statusTone = (s: string) => s === 'LIVE' ? 'green' : s === 'PAUSED' ? 'amber' : 'muted';

export default function AnalyticsPage() {
  const query = useQuery({ queryKey: ['automations'], queryFn: async () => (await automationApi.list()).data.data as Automation[], refetchInterval: 30_000, refetchIntervalInBackground: false });
  const { data, isLoading, isError } = query;
  const list = data ?? [];
  const totalSent = list.reduce((s, a) => s + (a.sentCount ?? 0), 0);
  const live = list.filter((a) => a.status === 'LIVE').length;
  const topSent = Math.max(1, ...list.map((a) => a.sentCount ?? 0));

  return (
    <div>
      <PageHead title="Analytics" sub="See DM delivery and tracked link activity across your automations. Open an automation for its run history." />

      {isError && (
        <Card style={{ marginBottom: 18, borderColor: 'var(--error)' }}>
          <div role="alert" style={{ color: RL.ink, fontSize: 14, lineHeight: 1.5 }}>
            Analytics could not refresh automation data{data ? '; the figures shown are from the last successful load.' : '.'}
          </div>
          <Btn variant="ghost" style={{ marginTop: 12 }} onClick={() => void query.refetch()}>Try again</Btn>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skel key={i} h={112} />)}</div>
      ) : isError && !data ? (
        null
      ) : list.length === 0 ? (
        <Empty icon={<BarChart2 style={{ width: 24, height: 24 }} />} title="Nothing to measure yet" sub="Create an automation and send your first DMs — your performance will appear here." />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Total DMs sent" value={totalSent.toLocaleString()} delta="across all automations" icon={<Send style={{ width: 18, height: 18 }} />} />
            <Stat label="Automations" value={list.length} delta={`${live} live`} icon={<Zap style={{ width: 18, height: 18 }} />} />
            <Stat label="Set to Live" value={live} delta={live ? 'eligible for new events' : 'none enabled'} icon={<Activity style={{ width: 18, height: 18 }} />} />
          </div>

          <h2 style={{ fontSize: 17, fontWeight: 700, color: RL.ink, margin: '0 0 14px' }}>Performance by automation</h2>
          <Card pad={0}>
            {list.map((a, i) => {
              const sent = a.sentCount ?? 0;
              return (
                <Link key={a.id} href={`/dashboard/automations/${a.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 no-underline lg:grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_auto] lg:px-5"
                  style={{ borderBottom: i < list.length - 1 ? `1px solid ${RL.lineSoft}` : 'none' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 650, color: RL.ink }}>{a.name}</span>
                      <Pill tone={statusTone(a.status)}>{a.status.toLowerCase()}</Pill>
                    </div>
                    {a.health && <div style={{ marginTop: 5 }}><Pill tone={healthTone(a.health.level)} dot>{a.health.label}</Pill></div>}
                  </div>
                  <div className="col-span-2 min-w-0 lg:col-span-1">
                    <div style={{ height: 8, borderRadius: 999, background: RL.softer, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(sent / topSent) * 100}%`, background: RL.teal, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 12, color: RL.muted, marginTop: 5 }}>{sent.toLocaleString()} DMs sent</div>
                  </div>
                  <ArrowRight className="hidden lg:block" style={{ width: 17, height: 17, color: RL.faint }} aria-hidden />
                </Link>
              );
            })}
          </Card>
          <p style={{ fontSize: 13, color: RL.muted, marginTop: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
            <MousePointerClick style={{ width: 15, height: 15 }} /> Tracked link clicks and per-run delivery history are available inside each automation.
          </p>
        </>
      )}
    </div>
  );
}
