'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../../../../../services/api';
import { Btn, Card, Empty, PageHead, Pill, Skel } from '../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../store/authStore';

type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'ACTIONED' | 'DISMISSED';
type Report = {
  id: string;
  reportedUsername: string;
  reportedDisplayName: string;
  reason: 'IMPERSONATION' | 'SCAM' | 'INAPPROPRIATE' | 'SPAM' | 'COPYRIGHT' | 'OTHER';
  details: string | null;
  status: ReportStatus;
  moderationNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  profile: { id: string; visibility: 'PUBLIC' | 'PRIVATE'; currentHandle: { username: string } | null } | null;
  reviewedBy: { id: string; name: string } | null;
};
type ReportPage = { page: number; pageSize: number; total: number; reports: Report[]; hasMore: boolean };

const labels: Record<ReportStatus, string> = { OPEN: 'Open', IN_REVIEW: 'In review', ACTIONED: 'Actioned', DISMISSED: 'Dismissed' };
const tones: Record<ReportStatus, 'amber' | 'muted' | 'green' | 'muted'> = { OPEN: 'amber', IN_REVIEW: 'muted', ACTIONED: 'green', DISMISSED: 'muted' };
const reasonLabels: Record<Report['reason'], string> = {
  IMPERSONATION: 'Impersonation', SCAM: 'Scam or fraud', INAPPROPRIATE: 'Inappropriate content',
  SPAM: 'Spam', COPYRIGHT: 'Copyright concern', OTHER: 'Other',
};

export default function AdminProfileReportsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const hasPermission = user?.role === 'SUPER_ADMIN' || Boolean(user?.adminPermissions?.includes('PROFILE_MODERATE'));
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ReportStatus | ''>('OPEN');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const client = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'profile-reports', page, status],
    enabled: isAdmin && hasPermission,
    queryFn: async () => (await adminApi.publicProfileReports(page, status || undefined)).data.data as ReportPage,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const review = useMutation({
    mutationFn: ({ id, nextStatus, note }: { id: string; nextStatus: Exclude<ReportStatus, 'OPEN'>; note: string }) =>
      adminApi.reviewPublicProfileReport(id, nextStatus, note),
    onSuccess: async () => {
      toast.success('Report review saved.');
      await client.invalidateQueries({ queryKey: ['admin', 'profile-reports'] });
    },
    onError: () => toast.error('Could not save this review. Refresh the queue and try again.'),
  });
  const restore = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.restorePublicProfileReport(id, reason),
    onSuccess: async () => {
      toast.success('Profile restored and the action recorded.');
      await client.invalidateQueries({ queryKey: ['admin', 'profile-reports'] });
    },
    onError: () => toast.error('Could not restore this profile. Refresh the queue and check its account status.'),
  });

  if (!isAdmin || !hasPermission) return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
    <ShieldAlert style={{ width: 26, height: 26, color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden />
    <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Profile moderation access required</h1>
    <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Only administrators granted the profile moderation permission can review reports.</p>
  </Card>;

  function submit(report: Report, nextStatus: Exclude<ReportStatus, 'OPEN'>) {
    const note = (notes[report.id] ?? '').trim();
    if (note.length < 5) {
      toast.error('Add a short internal review note (at least 5 characters).');
      return;
    }
    if (nextStatus === 'ACTIONED' && !window.confirm(`Hide @${report.profile?.currentHandle?.username ?? report.reportedUsername} from the public web?`)) return;
    review.mutate({ id: report.id, nextStatus, note });
  }

  function restoreProfile(report: Report) {
    const reason = (notes[report.id] ?? '').trim();
    if (reason.length < 10) {
      toast.error('Add a restoration reason (at least 10 characters).');
      return;
    }
    if (!window.confirm(`Restore @${report.profile?.currentHandle?.username ?? report.reportedUsername} as a public profile?`)) return;
    restore.mutate({ id: report.id, reason });
  }

  return <div>
    <PageHead title="Public profile reports" sub="Review visitor reports. Profile owners’ private account details are not shown here."
      action={<Btn variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw size={15} aria-hidden />Refresh</Btn>} />
    <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>{query.data ? `${query.data.total.toLocaleString()} report${query.data.total === 1 ? '' : 's'}` : 'Reports refresh automatically.'}</span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--text-muted)', fontSize: 13 }}>
        Status
        <select value={status} onChange={(event) => { setStatus(event.target.value as ReportStatus | ''); setPage(1); }}
          style={{ minHeight: 38, borderRadius: 9, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <option value="OPEN">Open</option><option value="IN_REVIEW">In review</option><option value="ACTIONED">Actioned</option><option value="DISMISSED">Dismissed</option><option value="">All reports</option>
        </select>
      </label>
    </Card>

    {query.isError ? <Card style={{ padding: 28, textAlign: 'center' }}><p role="alert" style={{ color: 'var(--error)' }}>Could not load profile reports.</p><Btn variant="ghost" onClick={() => query.refetch()}>Try again</Btn></Card>
      : query.isLoading ? <div style={{ display: 'grid', gap: 10 }}><Skel h={180} /><Skel h={180} /></div>
        : query.data?.reports.length ? <>
          <div style={{ display: 'grid', gap: 12 }}>
            {query.data.reports.map((report) => {
              const terminal = report.status === 'ACTIONED' || report.status === 'DISMISSED';
              const currentUsername = report.profile?.currentHandle?.username ?? report.reportedUsername;
              return <Card key={report.id} pad={18}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Flag size={16} aria-hidden color="var(--text-muted)" />
                      <strong style={{ color: 'var(--text)', fontSize: 15 }}>{report.reportedDisplayName} · @{currentUsername}</strong>
                      <Pill tone={tones[report.status]} dot>{labels[report.status]}</Pill>
                    </div>
                    <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                      {reasonLabels[report.reason]} · Reported {new Date(report.createdAt).toLocaleString()}
                      {report.profile && ` · Profile ${report.profile.visibility.toLowerCase()}`}
                      {!report.profile && ' · Profile no longer exists'}
                    </p>
                    {report.details && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '12px 0 0', padding: 12, borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, lineHeight: 1.55 }}>{report.details}</p>}
                    {report.moderationNote && <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: 12.5 }}><strong>Internal note:</strong> {report.moderationNote}</p>}
                    {!terminal && <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                      <label htmlFor={`profile-report-note-${report.id}`} style={{ color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600 }}>Internal review note</label>
                      <textarea id={`profile-report-note-${report.id}`} value={notes[report.id] ?? ''} maxLength={1000}
                        onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value.slice(0, 1000) }))}
                        placeholder="Record the reason for your decision; this is not sent to the reporter or creator."
                        style={{ minHeight: 68, resize: 'vertical', borderRadius: 9, padding: '10px 12px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', font: 'inherit' }} />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Btn variant="ghost" loading={review.isPending} disabled={review.isPending || (notes[report.id] ?? '').trim().length < 5} onClick={() => submit(report, 'IN_REVIEW')}>Keep in review</Btn>
                        <Btn variant="ghost" loading={review.isPending} disabled={review.isPending || (notes[report.id] ?? '').trim().length < 5} onClick={() => submit(report, 'DISMISSED')}>Dismiss report</Btn>
                        <Btn variant="danger" loading={review.isPending} disabled={review.isPending || (notes[report.id] ?? '').trim().length < 5} onClick={() => submit(report, 'ACTIONED')}>Hide profile</Btn>
                      </div>
                    </div>}
                    {terminal && report.reviewedBy && <p style={{ margin: '9px 0 0', color: 'var(--text-faint)', fontSize: 11.5 }}>Reviewed by {report.reviewedBy.name}{report.reviewedAt ? ` · ${new Date(report.reviewedAt).toLocaleString()}` : ''}</p>}
                    {report.status === 'ACTIONED' && report.profile?.visibility === 'PRIVATE' && <div style={{ display: 'grid', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <label htmlFor={`profile-restore-note-${report.id}`} style={{ color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600 }}>Reason for restoring</label>
                      <textarea id={`profile-restore-note-${report.id}`} value={notes[report.id] ?? ''} maxLength={500}
                        onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value.slice(0, 500) }))}
                        placeholder="Record why the restriction is being lifted."
                        style={{ minHeight: 64, resize: 'vertical', borderRadius: 9, padding: '10px 12px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', font: 'inherit' }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Btn variant="ghost" loading={restore.isPending} disabled={restore.isPending || (notes[report.id] ?? '').trim().length < 10} onClick={() => restoreProfile(report)}>Restore profile</Btn>
                      </div>
                    </div>}
                  </div>
                </div>
              </Card>;
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 18 }}>
            <Btn variant="ghost" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn>
            <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Page {page}</span>
            <Btn variant="ghost" disabled={!query.data.hasMore || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Btn>
          </div>
        </> : <Empty icon={<Flag size={24} />} title="No profile reports" sub={status ? `There are no ${labels[status]} reports.` : 'Visitor reports will appear here.'} />}
  </div>;
}
