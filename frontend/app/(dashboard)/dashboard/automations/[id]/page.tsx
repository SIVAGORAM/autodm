'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { automationApi } from '../../../../../services/api';
import { Button, Card, Badge, Skeleton, StatTile } from '../../../../../components/ui/primitives';
import { ArrowLeft, AlertTriangle, CheckCircle2, PauseCircle, Pencil, Play, RefreshCw } from 'lucide-react';

const healthTone: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  healthy: 'success', at_risk: 'warning', needs_reconnect: 'danger', paused: 'muted', draft: 'muted',
};
const runTone: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  SENT: 'success', SKIPPED: 'warning', FAILED: 'danger', UNKNOWN: 'warning', PENDING: 'muted',
};

export default function AutomationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const a = useQuery({ queryKey: ['automation', id], queryFn: async () => (await automationApi.get(id)).data.data, refetchInterval: 30_000, refetchIntervalInBackground: false });
  const stats = useQuery({ queryKey: ['automation-stats', id], queryFn: async () => (await automationApi.analytics(id)).data.data, refetchInterval: 15_000, refetchIntervalInBackground: false });
  const log = useInfiniteQuery({
    queryKey: ['automation-runs', id],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => (await automationApi.runs(id, pageParam ?? undefined)).data.data as { runs: any[]; nextCursor: string | null },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const logRows = log.data?.pages.flatMap((page) => page.runs) ?? [];

  const setStatus = useMutation({
    mutationFn: (status: 'LIVE' | 'PAUSED') => automationApi.setStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automation', id] }); qc.invalidateQueries({ queryKey: ['automations'] }); },
  });

  const health = a.data?.health;
  const HIcon = health?.level === 'healthy' ? CheckCircle2 : health?.level === 'needs_reconnect' ? AlertTriangle : health?.level === 'paused' ? PauseCircle : AlertTriangle;

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/automations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Automations
      </Link>

      {a.isLoading && <Skeleton className="h-24 w-full" />}

      {a.data && (
        <>
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{a.data.name}</h1>
              {a.data.igAccount?.username && <p className="text-sm text-muted-foreground">@{a.data.igAccount.username}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => router.push(`/dashboard/automations/${id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>
              {a.data.status === 'DRAFT' ? (
                <Button variant="accent" loading={setStatus.isPending} onClick={() => setStatus.mutate('LIVE')}>
                  <Play className="mr-1.5 h-4 w-4" /> Publish &amp; Go Live
                </Button>
              ) : (
                <Button variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate(a.data.status === 'LIVE' ? 'PAUSED' : 'LIVE')}>
                  {a.data.status === 'LIVE' ? 'Pause' : 'Resume'}
                </Button>
              )}
            </div>
          </header>

          {setStatus.isError && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(setStatus.error as any)?.response?.data?.message ?? 'Could not update status. Please try again.'}
            </div>
          )}

          {/* Health banner — the reliability wedge */}
          {health && (
            <Card className={`flex items-center justify-between gap-4 p-4 ${health.level === 'needs_reconnect' ? 'border-destructive/40' : health.level === 'at_risk' ? 'border-warning/40' : ''}`}>
              <div className="flex items-center gap-3">
                <HIcon className={`h-6 w-6 ${health.level === 'healthy' ? 'text-success' : health.level === 'needs_reconnect' ? 'text-destructive' : health.level === 'paused' ? 'text-muted-foreground' : 'text-warning'}`} />
                <div>
                  <div className="flex items-center gap-2"><span className="font-medium text-foreground">{health.label}</span><Badge tone={healthTone[health.level]}>{a.data.status.toLowerCase()}</Badge></div>
                  <p className="text-sm text-muted-foreground">{health.reason}</p>
                </div>
              </div>
              {health.level === 'needs_reconnect' && (
                <Link href="/dashboard/instagram"><Button variant="accent"><RefreshCw className="h-4 w-4" /> Reconnect</Button></Link>
              )}
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Runs" value={stats.data?.runs ?? (stats.isLoading ? '—' : 0)} />
            <StatTile label="Sent" value={stats.data?.sent ?? (stats.isLoading ? '—' : 0)} />
            <StatTile label="Clicks" value={stats.data?.clicks ?? (stats.isLoading ? '—' : 0)} />
          </div>

          {/* Delivery log */}
          <div>
            <h2 className="mb-2 text-lg font-medium text-foreground">Delivery log</h2>
            <Card className="overflow-hidden">
              {log.isLoading && <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>}
              {log.isError && logRows.length === 0 && (
                <div role="alert" className="p-6 text-center text-sm text-muted-foreground">
                  <p className="mb-3">Couldn’t load delivery history.</p>
                  <Button variant="secondary" onClick={() => log.refetch()}>Try again</Button>
                </div>
              )}
              {log.data && logRows.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">No runs yet. When someone triggers this automation, every DM shows up here.</p>
              )}
              {logRows.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs text-muted-foreground">
                    <tr><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Contact</th><th className="p-3 font-medium">Detail</th><th className="p-3 font-medium">When</th></tr>
                  </thead>
                  <tbody>
                    {logRows.map((r: any) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="p-3"><Badge tone={runTone[r.status] ?? 'muted'}>{r.status.toLowerCase()}</Badge></td>
                        <td className="p-3 text-foreground">
                          <div>{r.username ? `@${r.username}` : '—'}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{r.followUpOrder == null ? 'Primary DM' : `Follow-up ${r.followUpOrder + 1}`}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{r.error ?? (r.status === 'SENT' ? 'Delivered' : r.status === 'UNKNOWN' ? 'Check Instagram before retrying' : '')}</td>
                        <td className="p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {logRows.length > 0 && log.hasNextPage && (
                <div className="flex flex-col items-center gap-2 border-t border-border p-4">
                  {log.isFetchNextPageError && <p role="alert" className="text-center text-sm text-muted-foreground">Older runs couldn’t be loaded. Your current results are still available.</p>}
                  <Button variant="secondary" disabled={log.isFetchingNextPage} onClick={() => log.fetchNextPage()}>
                    {log.isFetchingNextPage ? 'Loading…' : log.isFetchNextPageError ? 'Try loading older runs again' : 'Load older runs'}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
