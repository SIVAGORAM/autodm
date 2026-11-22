'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Mail, RefreshCw, ShieldAlert } from 'lucide-react';
import { adminApi } from '../../../../../services/api';
import { Btn, Card, Empty, PageHead, Pill, Skel, Stat } from '../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../store/authStore';

type MailStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';
type MailFilter = 'NEEDS_ATTENTION' | MailStatus;
type OutboxMessage = {
  id: string;
  category: string;
  status: MailStatus | 'UNKNOWN';
  attempts: number;
  nextAttemptAt: string;
  expiresAt: string;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
  errorCode: string | null;
};
type OutboxPage = {
  counts: Record<MailStatus, number>;
  page: number;
  messages: OutboxMessage[];
  hasMore: boolean;
};

const filters: { value: MailFilter; label: string }[] = [
  { value: 'NEEDS_ATTENTION', label: 'Needs attention' },
  { value: 'PENDING', label: 'Queued' },
  { value: 'PROCESSING', label: 'Sending' },
  { value: 'SENT', label: 'Provider accepted' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const statusTone = (status: OutboxMessage['status']) => {
  if (status === 'SENT') return 'green';
  if (status === 'FAILED') return 'red';
  if (status === 'PENDING' || status === 'PROCESSING') return 'amber';
  return 'muted';
};

const categoryLabel: Record<string, string> = {
  verification: 'Email verification',
  'password-reset': 'Password reset',
  welcome: 'Welcome / trial',
  'support-reply': 'Support reply',
  'support-admin': 'Support alert',
  other: 'Other message',
};

const errorLabel: Record<string, string> = {
  expired: 'Message expired before delivery',
  action_no_longer_current: 'Message became outdated',
  payload_invalid: 'Stored message could not be read',
  attempt_limit_reached: 'Retry limit reached',
  delivery_failed: 'Email provider did not accept the message',
  other: 'Unclassified delivery issue',
};

const format = (value: string | null) => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

export default function MailOperationsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [filter, setFilter] = useState<MailFilter>('NEEDS_ATTENTION');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'mail-outbox', page, filter],
    enabled: isAdmin,
    queryFn: async () => {
      const status = filter === 'NEEDS_ATTENTION' ? undefined : filter;
      return (await adminApi.mailOutbox(page, status)).data.data as OutboxPage;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (!isAdmin) {
    return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
      <ShieldAlert style={{ width: 26, height: 26, color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden />
      <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Administrator access required</h1>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>This operations page is restricted to active administrator accounts.</p>
    </Card>;
  }

  const chooseFilter = (next: MailFilter) => { setFilter(next); setPage(1); };

  return (
    <div>
      <PageHead
        title="Mail delivery"
        sub="Review transactional email queue health and terminal failures. Recipients, message contents, OTPs, and reset links are never displayed."
        action={<Btn variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw style={{ width: 15, height: 15 }} aria-hidden /> Refresh
        </Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
        {(['PENDING', 'PROCESSING', 'FAILED', 'SENT'] as MailStatus[]).map((status) => (
          <Stat key={status} label={{ PENDING: 'Queued', PROCESSING: 'Sending', FAILED: 'Failed', SENT: 'Accepted by provider', CANCELLED: 'Cancelled' }[status]} value={query.data?.counts[status] ?? '—'} />
        ))}
      </div>

      <Card style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
        <AlertTriangle style={{ width: 17, height: 17, flexShrink: 0, marginTop: 2, color: 'var(--warning)' }} aria-hidden />
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.55 }}>
          “Accepted by provider” confirms SMTP acceptance only. It does not confirm inbox delivery. Failed messages are not manually replayed here; verification users can request a fresh code, and support/reset failures require operator follow-up.
        </p>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--text-muted)', fontSize: 13 }}>
          Status
          <select aria-label="Filter mail by status" value={filter} onChange={(event) => chooseFilter(event.target.value as MailFilter)} style={{ height: 38, padding: '0 10px', borderRadius: 9, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>Refreshes every 30 seconds</span>
      </div>

      {query.isError ? (
        <Card style={{ textAlign: 'center', padding: 32 }}>
          <p role="alert" style={{ color: 'var(--error)', margin: '0 0 12px' }}>Could not load mail delivery data.</p>
          <Btn variant="ghost" onClick={() => query.refetch()}>Try again</Btn>
        </Card>
      ) : query.isLoading ? (
        <Card pad={18}><div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2].map((item) => <Skel key={item} h={92} />)}</div></Card>
      ) : query.data?.messages.length === 0 ? (
        <Empty icon={<Mail style={{ width: 24, height: 24 }} />} title="No mail in this view" sub={filter === 'NEEDS_ATTENTION' ? 'There are no queued, sending, or failed messages to review.' : 'No messages match the selected status.'} />
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10 }}>
            {query.data?.messages.map((message) => (
              <Card key={message.id} pad={18}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--text)', fontSize: 14.5 }}>{categoryLabel[message.category] ?? categoryLabel.other}</strong>
                      <Pill tone={statusTone(message.status)} dot>{message.status.toLowerCase()}</Pill>
                    </div>
                    {message.errorCode && <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>{errorLabel[message.errorCode] ?? errorLabel.other}</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 9, color: 'var(--text-faint)', fontSize: 12 }}>
                      <span>{message.attempts} attempts</span>
                      <span>Created {format(message.createdAt)}</span>
                      {message.status === 'PENDING' && <span>Next attempt {format(message.nextAttemptAt)}</span>}
                      {message.sentAt && <span>Provider accepted {format(message.sentAt)}</span>}
                      {message.failedAt && <span>Failed {format(message.failedAt)}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <Btn variant="ghost" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn>
            <span style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Page {page}</span>
            <Btn variant="ghost" disabled={!query.data?.hasMore || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Btn>
          </div>
        </>
      )}
    </div>
  );
}
