'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi } from '../../../../../services/api';
import { Btn, Card, Empty, PageHead, Pill, Skel } from '../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../store/authStore';
import { LifeBuoy, RefreshCw, ShieldAlert } from 'lucide-react';

type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
type SupportRequest = {
  id: string;
  type: 'SUPPORT' | 'FEEDBACK';
  status: SupportStatus;
  subject: string;
  messages: { id: string; senderType: 'CUSTOMER' | 'ADMIN'; body: string; createdAt: string }[];
  rating: number | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
};
type SupportPage = { page: number; pageSize: number; total: number; requests: SupportRequest[]; hasMore: boolean };

const statusLabel: Record<SupportStatus, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In review', RESOLVED: 'Resolved',
};
const statusTone: Record<SupportStatus, 'muted' | 'amber' | 'green'> = {
  OPEN: 'muted', IN_PROGRESS: 'amber', RESOLVED: 'green',
};

export default function AdminSupportPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SupportStatus | ''>('OPEN');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'support-requests', page, status],
    enabled: isAdmin,
    queryFn: async () => (await adminApi.supportRequests(page, status || undefined)).data.data as SupportPage,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const update = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: SupportStatus }) => adminApi.updateSupportRequest(id, nextStatus),
    onSuccess: async () => {
      toast.success('Request status updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'support-requests'] });
    },
    onError: () => toast.error('Could not update this request. Refresh and try again.'),
  });
  const reply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => adminApi.replyToSupportRequest(id, body),
    onSuccess: async (_result, variables) => {
      setReplies((current) => ({ ...current, [variables.id]: '' }));
      toast.success('Reply saved. Email notification queued.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'support-requests'] });
    },
    onError: () => toast.error('Could not send reply. Refresh and try again.'),
  });

  if (!isAdmin) {
    return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
      <ShieldAlert style={{ width: 26, height: 26, color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden />
      <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Administrator access required</h1>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Support requests are visible only to active administrator accounts.</p>
    </Card>;
  }

  return (
    <div>
      <PageHead title="Support inbox" sub="Review customer requests and feedback. Messages are visible only to authorized administrators."
        action={<Btn variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw style={{ width: 15, height: 15 }} aria-hidden />Refresh</Btn>} />

      <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>{query.data ? `${query.data.total.toLocaleString()} request${query.data.total === 1 ? '' : 's'}` : 'Requests update automatically.'}</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--text-muted)', fontSize: 13 }}>
          Filter
          <select value={status} onChange={(event) => { setStatus(event.target.value as SupportStatus | ''); setPage(1); }}
            style={{ minHeight: 38, borderRadius: 9, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="">All requests</option>
          </select>
        </label>
      </Card>

      {query.isError ? (
        <Card style={{ textAlign: 'center', padding: 30 }}>
          <p role="alert" style={{ color: 'var(--error)', margin: '0 0 12px' }}>Could not load support requests.</p>
          <Btn variant="ghost" onClick={() => query.refetch()}>Try again</Btn>
        </Card>
      ) : query.isLoading ? (
        <div style={{ display: 'grid', gap: 10 }}><Skel h={160} /><Skel h={160} /></div>
      ) : query.data?.requests.length ? (
        <>
          <div style={{ display: 'grid', gap: 10 }}>
            {query.data.requests.map((request) => (
              <Card key={request.id} pad={18}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14.5, color: 'var(--text)' }}>{request.subject}</strong>
                      <Pill tone={request.type === 'SUPPORT' ? 'violet' : 'lime'}>{request.type === 'SUPPORT' ? 'Support' : 'Feedback'}</Pill>
                      <Pill tone={statusTone[request.status]} dot>{statusLabel[request.status]}</Pill>
                    </div>
                    <div style={{ marginTop: 7, color: 'var(--text-muted)', fontSize: 12.5, overflowWrap: 'anywhere' }}>
                      {request.user.name} · {request.user.email} · {new Date(request.createdAt).toLocaleString()}
                      {request.rating ? ` · Rating ${request.rating}/5` : ''}
                    </div>
                    <div style={{ display: 'grid', gap: 9, marginTop: 14 }}>
                      {request.messages.map((item) => (
                        <div key={item.id} style={{ padding: '10px 12px', borderRadius: 10, background: item.senderType === 'ADMIN' ? 'var(--accent-soft)' : 'var(--surface)', border: '1px solid var(--border)' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11.5, marginBottom: 5 }}>{item.senderType === 'ADMIN' ? 'HeyLaunch team' : request.user.name} · {new Date(item.createdAt).toLocaleString()}</div>
                          <p style={{ margin: 0, color: 'var(--text)', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.body}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                      <label htmlFor={`admin-reply-${request.id}`} style={{ color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600 }}>Reply to customer</label>
                      <textarea id={`admin-reply-${request.id}`} value={replies[request.id] ?? ''} maxLength={5_000}
                        onChange={(event) => setReplies((current) => ({ ...current, [request.id]: event.target.value.slice(0, 5_000) }))}
                        style={{ minHeight: 80, resize: 'vertical', borderRadius: 9, padding: '10px 12px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', font: 'inherit' }} placeholder="Write a helpful response…" />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Btn variant="ghost" loading={reply.isPending} disabled={(replies[request.id] ?? '').trim().length < 1} onClick={() => reply.mutate({ id: request.id, body: replies[request.id] ?? '' })}>Send reply</Btn>
                      </div>
                    </div>
                  </div>
                  <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12.5 }}>
                    Update status
                    <select value={request.status} disabled={update.isPending}
                      onChange={(event) => update.mutate({ id: request.id, nextStatus: event.target.value as SupportStatus })}
                      style={{ minHeight: 38, borderRadius: 9, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In review</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </label>
                </div>
              </Card>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 18 }}>
            <Btn variant="ghost" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn>
            <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Page {page}</span>
            <Btn variant="ghost" disabled={!query.data.hasMore || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Btn>
          </div>
        </>
      ) : (
        <Empty icon={<LifeBuoy style={{ width: 24, height: 24 }} />} title="No support requests" sub={status ? `There are no ${statusLabel[status]} requests.` : 'Customer support requests and feedback will appear here.'} />
      )}
    </div>
  );
}
