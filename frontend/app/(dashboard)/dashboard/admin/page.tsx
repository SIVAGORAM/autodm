'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, RefreshCw, ShieldAlert, UsersRound } from 'lucide-react';
import { adminApi } from '../../../../services/api';
import { Btn, Card, PageHead, Pill, Skel } from '../../../../components/rl-kit';
import { useAuthStore } from '../../../../store/authStore';

type Overview = {
  generatedAt: string;
  metrics: Record<string, number>;
  services: { database: string; queue: string; worker: string };
  queue: { waiting?: number; active?: number; delayed?: number; failed?: number } | null;
  workerLastHeartbeatAt: string | null;
};
type AuditPage = { events: { id: string; action: string; targetType: string; targetId: string | null; reason: string; requestId: string; createdAt: string; actor: { id: string; name: string; email: string } | null }[]; total: number };

const metricLabels: Record<string, string> = {
  customers: 'Registered customers', activeCustomers: 'Active customers', suspendedCustomers: 'Suspended',
  deletionRequests: 'Deletion requests', adminAccounts: 'Active administrators', mfaPendingAdmins: 'Admins needing MFA', instagramAccounts: 'Instagram accounts',
  activeInstagramAccounts: 'Connected accounts', liveAutomations: 'Live automations', failedRuns: 'Failed runs',
  openSupport: 'Open support requests', openProfileReports: 'Open profile reports', newEnquiries: 'New contact enquiries', failedMail: 'Failed email deliveries', deadLetters: 'Webhook dead letters',
};

export default function AdminCommandCenterPage() {
  const user = useAuthStore((state) => state.user);
  const [action, setAction] = useState('');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const overview = useQuery({
    queryKey: ['admin', 'command-center'], enabled: isSuperAdmin,
    queryFn: async () => (await adminApi.commandCenter()).data.data as Overview,
    refetchInterval: 30_000, refetchOnWindowFocus: true,
  });
  const audit = useQuery({
    queryKey: ['admin', 'audit-events', action], enabled: isSuperAdmin,
    queryFn: async () => (await adminApi.auditEvents({ page: 1, pageSize: 12, action: action || undefined })).data.data as AuditPage,
  });

  if (!isSuperAdmin) return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
    <ShieldAlert style={{ width: 26, height: 26, color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden />
    <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Super Admin access required</h1>
    <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Platform-wide metrics and audit history are restricted to Super Admins.</p>
  </Card>;

  const data = overview.data;
  const serviceRows = [
    ['Database', data?.services.database], ['Queue / Redis', data?.services.queue], ['DM worker', data?.services.worker],
  ] as const;
  const tone = (value?: string) => value === 'healthy' ? 'green' : value === 'degraded' || value === 'unhealthy' ? 'red' : 'muted';

  return <div>
    <PageHead title="Command center" sub="Operational snapshot from the HeyLaunch database and job queue. Metrics refresh every 30 seconds; this is not an external uptime monitor." action={<Btn variant="ghost" onClick={() => { void overview.refetch(); void audit.refetch(); }} disabled={overview.isFetching}><RefreshCw style={{ width: 15, height: 15 }} aria-hidden /> Refresh</Btn>} />

    {overview.isError ? <div role="alert"><Card style={{ marginBottom: 16, color: 'var(--error)' }}>Could not load platform metrics. Check database and queue connectivity, then refresh.</Card></div> : null}
    {overview.isLoading ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>{Array.from({ length: 8 }, (_, i) => <Skel key={i} h={102} />)}</div> : data && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))', gap: 12, marginBottom: 20 }}>
        {Object.entries(metricLabels).map(([key, label]) => {
          const href = key === 'openSupport' ? '/dashboard/admin/support' : key === 'newEnquiries' ? '/dashboard/admin/enquiries' : key === 'deadLetters' ? '/dashboard/admin/webhooks' : '/dashboard/admin/customers';
          return <Link key={key} href={href} style={{ textDecoration: 'none' }}><Card hover pad={16}>
            <div style={{ color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600 }}>{label}</div>
            <div style={{ color: 'var(--text)', fontSize: 27, fontWeight: 750, letterSpacing: '-.7px', marginTop: 9 }}>{(data.metrics[key] ?? 0).toLocaleString()}</div>
          </Card></Link>;
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,310px),1fr))', gap: 14, marginBottom: 20 }}>
        <Card>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 14px', fontSize: 16, color: 'var(--text)' }}><Activity size={17} aria-hidden /> Service checks</h2>
          <div style={{ display: 'grid', gap: 11 }}>{serviceRows.map(([label, status]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><span style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>{label}</span><Pill tone={tone(status)} dot>{status ?? 'unknown'}</Pill></div>)}</div>
          <div style={{ marginTop: 14, color: 'var(--text-faint)', fontSize: 12 }}>Worker heartbeat: {data.workerLastHeartbeatAt ? new Date(data.workerLastHeartbeatAt).toLocaleString() : 'not available'}</div>
          {data.queue && <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12.5 }}>Queue: {data.queue.waiting ?? 0} waiting · {data.queue.active ?? 0} active · {data.queue.delayed ?? 0} delayed · {data.queue.failed ?? 0} failed</div>}
          {!data.queue && <p style={{ margin: '10px 0 0', color: 'var(--warning)', fontSize: 12.5 }}>Queue metrics unavailable; no queue health is inferred.</p>}
        </Card>
        <Card>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', fontSize: 16, color: 'var(--text)' }}><AlertTriangle size={17} aria-hidden /> Needs attention</h2>
          {data.metrics.deadLetters + data.metrics.failedMail + data.metrics.failedRuns + data.metrics.deletionRequests + data.metrics.mfaPendingAdmins + data.metrics.newEnquiries + data.metrics.openProfileReports === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 13.5, margin: 0 }}>No tracked backlog or failure counts are currently reported.</p>
            : <div style={{ display: 'grid', gap: 9, color: 'var(--text-muted)', fontSize: 13.5 }}>
              {data.metrics.deadLetters > 0 && <Link href="/dashboard/admin/webhooks">{data.metrics.deadLetters} webhook dead letter(s) need review</Link>}
              {data.metrics.openProfileReports > 0 && <Link href="/dashboard/admin/profile-reports">{data.metrics.openProfileReports} public profile report(s) need review</Link>}
              {data.metrics.failedMail > 0 && <Link href="/dashboard/admin/mail">{data.metrics.failedMail} failed email delivery record(s)</Link>}
              {data.metrics.newEnquiries > 0 && <Link href="/dashboard/admin/enquiries">{data.metrics.newEnquiries} new contact enquiry/enquiries</Link>}
              {data.metrics.failedRuns > 0 && <Link href="/dashboard/logs">{data.metrics.failedRuns} failed automation run(s)</Link>}
              {data.metrics.deletionRequests > 0 && <Link href="/dashboard/admin/customers">{data.metrics.deletionRequests} pending customer deletion request(s)</Link>}
              {data.metrics.mfaPendingAdmins > 0 && <Link href="/dashboard/admin/team">{data.metrics.mfaPendingAdmins} administrator account(s) need MFA enrollment</Link>}
            </div>}
        </Card>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 16, color: 'var(--text)' }}><UsersRound size={17} aria-hidden /> Recent administrative actions</h2>
          <input aria-label="Filter audit actions" placeholder="Filter by action" value={action} onChange={(event) => setAction(event.target.value)} maxLength={80} style={{ minHeight: 38, width: 'min(100%,240px)', padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }} />
        </div>
        {audit.isError ? <p role="alert" style={{ color: 'var(--error)' }}>Could not load audit events.</p> : audit.isLoading ? <Skel h={180} /> : !audit.data?.events.length ? <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>No matching admin actions yet.</p> : <div style={{ display: 'grid', gap: 0 }}>
          {audit.data.events.map((event) => <div key={event.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-soft)', alignItems: 'start' }}>
            <div><strong style={{ display: 'block', color: 'var(--text)', fontSize: 13 }}>{event.action.replaceAll('_', ' ')}</strong><span style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>{new Date(event.createdAt).toLocaleString()}</span></div>
            <div style={{ minWidth: 0 }}><span style={{ color: 'var(--text)', fontSize: 12.5 }}>{event.actor?.name || 'System / removed admin'}</span><div style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>{event.actor?.email || 'Actor unavailable'}</div></div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, overflowWrap: 'anywhere' }}>{event.targetType}{event.targetId ? ` · ${event.targetId}` : ''}<div style={{ marginTop: 3 }}>{event.reason}</div></div>
          </div>)}
        </div>}
      </Card>
      <p style={{ color: 'var(--text-faint)', fontSize: 11.5, textAlign: 'right' }}>Snapshot generated {new Date(data.generatedAt).toLocaleString()} · updates every 30 seconds</p>
    </>}
  </div>;
}
