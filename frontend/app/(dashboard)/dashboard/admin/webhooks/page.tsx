'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock3, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { adminApi } from '../../../../../services/api';
import { Btn, Card, Empty, PageHead, Pill, Skel } from '../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../store/authStore';

type DeadLetter = {
  id: string;
  type: 'comment' | 'message';
  attempts: number;
  redriveCount: number;
  payloadAvailable: boolean;
  errorSummary: string | null;
  createdAt: string;
  deadLetterAt: string | null;
  lastRedrivenAt: string | null;
  instagramAccount: string | null;
};
type DeadLetterPage = { page: number; events: DeadLetter[]; hasMore: boolean };
type WorkerHealth = {
  status: 'ok' | 'stale' | 'unavailable';
  lastHeartbeatAt?: string | null;
  heartbeatAgeMs?: number | null;
  queue?: {
    waiting?: number;
    active?: number;
    delayed?: number;
    failed?: number;
    oldestWaitingAgeMs?: number | null;
    nextDelayedAt?: string | null;
    delayedOverdueMs?: number | null;
  };
};

function ageLabel(milliseconds: number) {
  if (milliseconds < 60_000) return `${Math.floor(milliseconds / 1000)}s`;
  if (milliseconds < 3_600_000) return `${Math.floor(milliseconds / 60_000)}m`;
  if (milliseconds < 86_400_000) return `${Math.floor(milliseconds / 3_600_000)}h`;
  return `${Math.floor(milliseconds / 86_400_000)}d`;
}

export default function WebhookOperationsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [redriveReason, setRedriveReason] = useState('');
  const [notice, setNotice] = useState('');
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'webhook-dead-letters', page],
    enabled: isAdmin,
    queryFn: async () => (await adminApi.deadLetters(page)).data.data as DeadLetterPage,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const workerHealth = useQuery({
    queryKey: ['admin', 'worker-health'],
    enabled: isAdmin,
    queryFn: async () => {
      try {
        return (await adminApi.workerHealth()).data as WorkerHealth;
      } catch (error) {
        const response = (error as { response?: { data?: WorkerHealth } }).response;
        if (response?.data?.status) return response.data;
        throw error;
      }
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const redrive = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.redriveWebhookEvent(id, reason),
    onSuccess: async (response) => {
      const status = response.data.data.status as string;
      setNotice(status === 'queued'
        ? 'Redrive queued. Check delivery logs before taking further action.'
        : 'The receipt is pending recovery. The worker will retry when Redis is available.');
      setConfirmId(null);
      setRedriveReason('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'webhook-dead-letters'] });
    },
    onError: () => setNotice('Redrive failed or the event changed. Refresh the list and review its current state.'),
  });

  const format = (value: string) => new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  });

  if (!isAdmin) {
    return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
      <ShieldAlert style={{ width: 26, height: 26, color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden />
      <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Administrator access required</h1>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>This operations page is restricted to active administrator accounts.</p>
    </Card>;
  }

  return (
    <div>
      <PageHead
        title="Webhook operations"
        sub="Review failed Meta webhook receipts and request a controlled redrive. Raw event payloads and provider identifiers are never shown here."
        action={<Btn variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw style={{ width: 15, height: 15 }} /> Refresh
        </Btn>}
      />

      <Card style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }} aria-live="polite">
        <div>
          <strong style={{ display: 'block', color: 'var(--text)', fontSize: 14 }}>Message worker</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
            {workerHealth.isFetching && !workerHealth.data
              ? 'Checking worker heartbeat…'
              : workerHealth.data?.status === 'ok'
                ? `Heartbeat ${Math.max(0, Math.round((workerHealth.data.heartbeatAgeMs ?? 0) / 1000))}s ago`
                : workerHealth.data?.status === 'stale'
                  ? 'No recent worker heartbeat. Queued sends may be delayed.'
                  : 'Worker status is unavailable.'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill tone={workerHealth.data?.status === 'ok' ? 'green' : 'red'} dot>
            {workerHealth.data?.status === 'ok' ? 'online' : 'check worker'}
          </Pill>
          {workerHealth.data?.queue && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
              {workerHealth.data.queue.waiting ?? 0} waiting · {workerHealth.data.queue.active ?? 0} active · {workerHealth.data.queue.delayed ?? 0} delayed · {workerHealth.data.queue.failed ?? 0} failed
              {workerHealth.data.queue.oldestWaitingAgeMs !== null && workerHealth.data.queue.oldestWaitingAgeMs !== undefined
                ? ` · oldest waiting ${ageLabel(workerHealth.data.queue.oldestWaitingAgeMs)}`
                : ''}
              {(workerHealth.data.queue.delayedOverdueMs ?? 0) > 0
                ? ` · delayed overdue ${ageLabel(workerHealth.data.queue.delayedOverdueMs!)}`
                : workerHealth.data.queue.nextDelayedAt
                  ? ` · next delayed in ${ageLabel(Math.max(0, new Date(workerHealth.data.queue.nextDelayedAt).getTime() - Date.now()))}`
                  : ''}
            </span>
          )}
          <Btn variant="ghost" onClick={() => workerHealth.refetch()} disabled={workerHealth.isFetching} aria-label="Refresh worker health">
            <RefreshCw style={{ width: 14, height: 14 }} />
          </Btn>
        </div>
      </Card>

      <Card style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18, borderColor: 'var(--warning-soft)' }}>
        <AlertTriangle style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2, color: 'var(--warning)' }} aria-hidden />
        <div style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.55 }}>
          Redriving resumes webhook processing and may queue an Instagram message. Confirm the creator account and review delivery logs before retrying any uncertain delivery.
        </div>
      </Card>

      {notice && <div role="status" aria-live="polite" style={{ marginBottom: 14, color: 'var(--text-muted)', fontSize: 13.5 }}>{notice}</div>}
      {query.isError ? (
        <Card style={{ textAlign: 'center', padding: 32 }}>
          <p role="alert" style={{ color: 'var(--error)', margin: '0 0 12px' }}>Could not load webhook operations.</p>
          <Btn variant="ghost" onClick={() => query.refetch()}>Try again</Btn>
        </Card>
      ) : query.isLoading ? (
        <Card pad={18}><div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2].map((item) => <Skel key={item} h={92} />)}</div></Card>
      ) : (query.data?.events.length ?? 0) === 0 ? (
        <Empty icon={<ShieldAlert style={{ width: 24, height: 24 }} />} title="No dead-letter events" sub="Webhook events that exhaust automatic retries will appear here." />
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10 }}>
            {query.data!.events.map((event) => (
              <Card key={event.id} pad={18}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--text)', fontSize: 14.5 }}>{event.type === 'comment' ? 'Comment event' : 'Message event'}</strong>
                      <Pill tone="red" dot>dead letter</Pill>
                      {!event.payloadAvailable && <Pill tone="muted">payload expired</Pill>}
                      {event.instagramAccount && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{event.instagramAccount}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 10, color: 'var(--text-muted)', fontSize: 12.5 }}>
                      <span><Clock3 style={{ width: 13, height: 13, verticalAlign: '-2px', marginRight: 5 }} aria-hidden />Failed {format(event.deadLetterAt ?? event.createdAt)}</span>
                      <span>{event.attempts} automatic attempts</span>
                      <span>{event.redriveCount} previous redrives</span>
                    </div>
                    {event.errorSummary && <div style={{ marginTop: 7, color: 'var(--text-faint)', fontSize: 12 }}>{event.errorSummary}</div>}
                    {!event.payloadAvailable && <div style={{ marginTop: 7, color: 'var(--text-faint)', fontSize: 12 }}>The retained event payload has expired, so this event cannot be redriven.</div>}
                    {event.lastRedrivenAt && <div style={{ marginTop: 4, color: 'var(--text-faint)', fontSize: 12 }}>Last redriven {format(event.lastRedrivenAt)}</div>}
                  </div>
                  {isSuperAdmin && <Btn variant="ghost" disabled={redrive.isPending || !event.payloadAvailable} onClick={() => { setNotice(''); setRedriveReason(''); setConfirmId(confirmId === event.id ? null : event.id); }}>
                    <RotateCcw style={{ width: 15, height: 15 }} /> Redrive
                  </Btn>}
                </div>
                {confirmId === event.id && isSuperAdmin && (
                  <div style={{ display: 'grid', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, flex: '1 1 280px' }}>
                      Resume processing this event? It may enqueue a message; check the logs for uncertain prior deliveries first.
                    </p>
                    <label style={{ display: 'grid', gap: 6, maxWidth: 540, color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600 }}>
                      Reason for redrive
                      <textarea value={redriveReason} onChange={(input) => setRedriveReason(input.target.value)} maxLength={500} rows={2}
                        placeholder="Explain why this event is safe to retry" aria-label="Reason for redrive"
                        style={{ width: '100%', resize: 'vertical', borderRadius: 9, padding: '10px 12px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', font: 'inherit' }} />
                    </label>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <Btn variant="ghost" onClick={() => { setConfirmId(null); setRedriveReason(''); }}>Cancel</Btn>
                      <Btn variant="accent" loading={redrive.isPending} disabled={redriveReason.trim().length < 10}
                        onClick={() => redrive.mutate({ id: event.id, reason: redriveReason.trim() })}>Confirm redrive</Btn>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 18 }}>
            <Btn variant="ghost" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn>
            <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Page {page}</span>
            <Btn variant="ghost" disabled={!query.data?.hasMore || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Btn>
          </div>
        </>
      )}
    </div>
  );
}
