'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { automationApi } from '../../../../../services/api';
import { Button, Card, Badge, Skeleton, StatTile } from '../../../../../components/ui/primitives';
import { ArrowLeft, AlertTriangle, CheckCircle2, PauseCircle, Pencil, Play, RefreshCw, Gift, Sparkles, Download, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

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
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ['automation', id] });
      const previous = qc.getQueryData<any>(['automation', id]);
      if (previous) {
        qc.setQueryData(['automation', id], { ...previous, status });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['automation', id], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['automation', id] });
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  const giveaway = useQuery({
    queryKey: ['automation-giveaway', id],
    queryFn: async () => (await automationApi.getGiveaway(id)).data.data,
    enabled: !!a.data?.isGiveaway,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const pickWinner = useMutation({
    mutationFn: () => automationApi.pickGiveawayWinner(id),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['automation-giveaway', id] });
      const winner = res.data?.data;
      toast.success(`🎉 Winner picked: @${winner?.username} with ticket #${winner?.ticketNumber}!`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not pick winner.');
    },
  });

  const resetWinner = useMutation({
    mutationFn: () => automationApi.resetGiveawayWinner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation-giveaway', id] });
      toast.info('Giveaway winner reset. You can draw again anytime.');
    },
  });

  const handleExportCsv = async () => {
    try {
      const res = await automationApi.exportGiveawayEntries(id);
      const rows = res.data?.data ?? [];
      if (!rows.length) return toast.info('No entries to export yet.');
      const headers = ['Ticket Number', 'Instagram Username', 'Name', 'Email', 'Status', 'Won At', 'Entered At'];
      const csvContent = [
        headers.join(','),
        ...rows.map((r: any) => [
          r.ticketNumber,
          `"${r.username || ''}"`,
          `"${r.name || ''}"`,
          `"${r.email || ''}"`,
          r.status,
          r.wonAt || '',
          r.createdAt || '',
        ].join(',')),
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `giveaway-entries-${id.slice(0, 8)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Giveaway entries exported successfully!');
    } catch {
      toast.error('Could not export giveaway entries.');
    }
  };

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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">{a.data.name}</h1>
                <Badge tone="primary" className="text-xs">
                  {a.data.language === 'HINGLISH'
                    ? 'Hinglish (Hindi in English letters)'
                    : a.data.language === 'TENGLISH'
                    ? 'Telugu (English letters)'
                    : a.data.language === 'TELUGU_ENGLISH'
                    ? 'Telugu-English Hybrid'
                    : 'English'}
                </Badge>
              </div>
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

          {/* 1-Click Viral Giveaway / Lucky Draw Picker */}
          {(a.data.isGiveaway || (giveaway.data?.totalEntries ?? 0) > 0) && (
            <Card className="p-5 border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-background to-pink-500/5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600/10 text-purple-600">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">Viral Giveaway / Lucky Draw</h2>
                      <Badge tone="primary">Live Giveaway 🎟️</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {giveaway.data?.totalEntries ?? 0} participants entered with verified ticket numbers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="h-8 text-xs"
                    onClick={handleExportCsv}
                    disabled={!giveaway.data?.totalEntries}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export Entries
                  </Button>
                  <Button
                    variant="accent"
                    className="h-8 bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white"
                    loading={pickWinner.isPending}
                    disabled={!giveaway.data?.totalEntries || pickWinner.isPending}
                    onClick={() => pickWinner.mutate()}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Pick Random Winner 🎲
                  </Button>
                </div>
              </div>

              {/* Winner Highlight Card */}
              {giveaway.data?.winner ? (
                <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 p-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-2xl">
                        🏆
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Official Winner Selected</span>
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                            Ticket #{giveaway.data.winner.ticketNumber}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-foreground">
                          @{giveaway.data.winner.username}
                          {giveaway.data.winner.name && <span className="ml-2 text-sm font-normal text-muted-foreground">({giveaway.data.winner.name})</span>}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Drawn on {new Date(giveaway.data.winner.wonAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        loading={resetWinner.isPending}
                        onClick={() => resetWinner.mutate()}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Redraw / Reset
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    {giveaway.data?.totalEntries
                      ? `Ready to draw! Click "Pick Random Winner" above to draw from ${giveaway.data.totalEntries} verified entries.`
                      : 'No entries yet. When followers comment on your giveaway post, their unique lucky ticket numbers will appear here.'}
                  </p>
                </div>
              )}
            </Card>
          )}

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
