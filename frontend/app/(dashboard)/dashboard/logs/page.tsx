'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { automationApi } from '../../../../services/api';
import { RL, Card, Pill, Empty, Skel, PageHead, Btn } from '../../../../components/rl-kit';
import { FileText, RefreshCw, Clock } from 'lucide-react';

type Automation = { id: string; name: string; _count?: { runs: number } };
type Run = { id: string; status: string; error?: string | null; createdAt: string; sentAt?: string | null; username?: string | null; followUpOrder?: number | null };

const tone = (s: string) => s === 'SENT' ? 'green' : s === 'FAILED' ? 'red' : s === 'SKIPPED' || s === 'UNKNOWN' ? 'amber' : 'muted';
const FILTERS = ['all', 'SENT', 'PENDING', 'SKIPPED', 'FAILED', 'UNKNOWN'] as const;

export default function LogsPage() {
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const autos = useQuery({ queryKey: ['automations'], queryFn: async () => (await automationApi.list()).data.data as Automation[], refetchInterval: 30_000, refetchIntervalInBackground: false });
  const activeId = sel ?? autos.data?.[0]?.id ?? null;

  const runsQ = useInfiniteQuery({
    queryKey: ['runs', activeId], enabled: !!activeId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => (await automationApi.runs(activeId!, pageParam ?? undefined)).data.data as { runs: Run[]; nextCursor: string | null },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const runs = runsQ.data?.pages.flatMap((page) => page.runs) ?? [];
  const shown = runs.filter((r) => filter === 'all' || r.status === filter);
  const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <PageHead title="DM Logs" sub="A receipt for every automation run — who it matched, whether the DM sent, and why not if it didn’t."
        action={<Btn variant="ghost" onClick={() => runsQ.refetch()}><RefreshCw style={{ width: 15, height: 15 }} /> Refresh</Btn>} />

      {autos.isError && (
        <Card style={{ marginBottom: 18, borderColor: 'var(--error)' }}>
          <div role="alert" style={{ color: RL.ink, fontSize: 14, lineHeight: 1.5 }}>
            Automation list could not be refreshed{autos.data ? '; existing log filters may be out of date.' : '.'}
          </div>
          <Btn variant="ghost" style={{ marginTop: 12 }} onClick={() => void autos.refetch()}>Retry automations</Btn>
        </Card>
      )}

      {autos.isLoading ? <Skel h={120} /> : (autos.data?.length ?? 0) === 0 ? (
        autos.isError && !autos.data ? (
          <Card style={{ borderColor: 'var(--error)' }}>
            <p role="alert" style={{ color: RL.ink, margin: 0, fontSize: 14 }}>Delivery history is unavailable until the automation list loads.</p>
          </Card>
        ) : (
        <Empty icon={<FileText style={{ width: 24, height: 24 }} />} title="No logs yet" sub="Once an automation goes live and starts sending DMs, every send shows up here." />
        )
      ) : (
        <>
          {/* automation selector + filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 18, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {autos.data!.map((a) => (
                <button key={a.id} onClick={() => setSel(a.id)}
                  style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${activeId === a.id ? 'var(--text)' : 'var(--border)'}`, background: activeId === a.id ? 'var(--nav-selected)' : 'var(--surface)', color: activeId === a.id ? 'var(--text)' : 'var(--text-muted)' }}>
                  {a.name}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                    border: 'none', background: filter === f ? 'var(--btn-primary)' : 'var(--nav-selected)', color: filter === f ? 'var(--btn-primary-text)' : 'var(--text-muted)' }}>
                  {f === 'all' ? 'All' : f.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <Card pad={0}>
            {runsQ.isLoading ? <div style={{ padding: 20, display: 'grid', gap: 10 }}>{[0, 1, 2, 3].map((i) => <Skel key={i} h={44} />)}</div>
              : runsQ.isError && runs.length === 0 ? (
                <div role="alert" style={{ padding: 32, textAlign: 'center', color: RL.muted }}>
                  <div style={{ marginBottom: 12 }}>Couldn’t load delivery history.</div>
                  <Btn variant="ghost" onClick={() => runsQ.refetch()}>Try again</Btn>
                </div>
              )
              : shown.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: RL.muted }}>
                  <Clock style={{ width: 22, height: 22, margin: '0 auto 10px', color: RL.faint }} />
                  <div style={{ fontSize: 14.5 }}>No {filter === 'all' ? '' : filter.toLowerCase() + ' '}runs for this automation yet.</div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr', padding: '12px 20px', fontSize: 12, fontWeight: 600, color: RL.faint, borderBottom: `1px solid ${RL.line}`, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                    <span>Recipient / message</span><span>Status</span><span>Detail</span><span style={{ textAlign: 'right' }}>When</span>
                  </div>
                  {shown.map((r) => (
                    <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.2fr 1fr', padding: '13px 20px', fontSize: 13.5, alignItems: 'center', borderBottom: `1px solid ${RL.lineSoft}` }}>
                      <span style={{ display: 'grid', gap: 3 }}>
                        <span style={{ fontWeight: 600, color: RL.ink }}>{r.username ? `@${r.username}` : '—'}</span>
                        <span style={{ fontSize: 11.5, color: RL.faint }}>{r.followUpOrder == null ? 'Primary DM' : `Follow-up ${r.followUpOrder + 1}`}</span>
                      </span>
                      <span><Pill tone={tone(r.status) as any}>{r.status.toLowerCase()}</Pill></span>
                      <span style={{ color: RL.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.error || (r.status === 'SENT' ? 'Delivered' : r.status === 'UNKNOWN' ? 'Check Instagram before retrying' : '—')}</span>
                      <span style={{ textAlign: 'right', color: RL.muted }}>{fmt(r.sentAt || r.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            {runs.length > 0 && (
              <div style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: '16px 20px' }}>
                {runsQ.isFetchNextPageError && <div role="alert" style={{ color: RL.muted, fontSize: 13 }}>Older runs couldn’t be loaded. Your current results are still available.</div>}
                {runsQ.hasNextPage && (
                  <Btn variant="ghost" onClick={() => runsQ.fetchNextPage()} disabled={runsQ.isFetchingNextPage}>
                    {runsQ.isFetchingNextPage ? 'Loading…' : runsQ.isFetchNextPageError ? 'Try loading older runs again' : 'Load older runs'}
                  </Btn>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
