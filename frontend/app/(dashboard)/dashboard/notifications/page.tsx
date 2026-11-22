'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { automationApi, healthApi, instagramApi } from '../../../../services/api';
import { RL, Btn, Card, Pill, Empty, Skel, PageHead } from '../../../../components/rl-kit';
import { AlertTriangle, CheckCircle2, Instagram, RefreshCw } from 'lucide-react';

type Automation = { id: string; name: string; status: string; health?: { level: string; label: string; reason?: string } };
type IgAccount = {
  id: string;
  username: string;
  isActive: boolean;
  tokenExpiresAt?: string;
  webhookSubscribedAt?: string | null;
  lastWebhookAt?: string | null;
};
type WorkerStatus = { status: 'ok' | 'stale' | 'unavailable'; lastHeartbeatAt: string | null };

export default function NotificationsPage() {
  const autos = useQuery({
    queryKey: ['automations'],
    queryFn: async () => (await automationApi.list()).data.data as Automation[],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const igs = useQuery({
    queryKey: ['ig-accounts'],
    queryFn: async () => (await instagramApi.accounts()).data.data as IgAccount[],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const worker = useQuery({
    queryKey: ['creator-worker-status'],
    queryFn: async () => (await healthApi.workerStatus()).data.data as WorkerStatus,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const loading = autos.isLoading || igs.isLoading || worker.isLoading;
  const failed = autos.isError || igs.isError;

  type Note = { tone: 'coral' | 'amber' | 'green'; icon: React.ReactNode; title: string; body: string; href: string };
  const notes: Note[] = [];

  (autos.data ?? []).forEach((a) => {
    if (a.health?.level === 'at_risk' && a.health.reason !== 'Instagram connection expires soon.')
      notes.push({ tone: 'amber', icon: <AlertTriangle style={{ width: 18, height: 18 }} />, title: `${a.name} needs attention`, body: a.health.reason || a.health.label, href: `/dashboard/automations/${a.id}` });
  });
  (igs.data ?? []).filter((a) => a.isActive && a.tokenExpiresAt).forEach((a) => {
    const days = Math.ceil((new Date(a.tokenExpiresAt!).getTime() - Date.now()) / 86400000);
    if (days <= 7) {
      const expired = days <= 0;
      notes.push({
        tone: expired || days <= 2 ? 'coral' : 'amber',
        icon: <Instagram style={{ width: 18, height: 18 }} />,
        title: expired ? `@${a.username} connection expired` : `@${a.username} token expiring`,
        body: expired
          ? 'Reconnect this Instagram account to resume automation.'
          : `Your Instagram connection expires in ${days} day${days === 1 ? '' : 's'}. Reconnect to avoid downtime.`,
        href: '/dashboard/instagram',
      });
    }
  });
  (igs.data ?? []).filter((a) => a.isActive && !a.webhookSubscribedAt).forEach((a) => {
    notes.push({
      tone: 'amber',
      icon: <Instagram style={{ width: 18, height: 18 }} />,
      title: `@${a.username} webhooks not confirmed`,
      body: 'Set up Instagram comment and message webhooks before relying on automations.',
      href: '/dashboard/instagram',
    });
  });
  (igs.data ?? []).filter((a) => a.isActive && a.webhookSubscribedAt && !a.lastWebhookAt).forEach((a) => {
    notes.push({
      tone: 'amber',
      icon: <Instagram style={{ width: 18, height: 18 }} />,
      title: `@${a.username} webhook delivery not verified`,
      body: 'The account subscription succeeded, but HeyLaunch has not received an event yet. Confirm Meta app webhook fields and permissions, then run a controlled test.',
      href: '/dashboard/instagram',
    });
  });
  if ((igs.data ?? []).filter((a) => a.isActive).length === 0 && !loading)
    notes.push({ tone: 'amber', icon: <Instagram style={{ width: 18, height: 18 }} />, title: 'No Instagram connected', body: 'Connect an account to start running automations.', href: '/dashboard/instagram' });
  if (worker.data?.status === 'stale') {
    notes.push({ tone: 'coral', icon: <AlertTriangle style={{ width: 18, height: 18 }} />, title: 'DM delivery worker is offline', body: 'Queued automations cannot run until delivery processing is back online. Contact support if this continues.', href: '/dashboard/help' });
  } else if (worker.data?.status === 'unavailable' || worker.isError) {
    notes.push({ tone: 'amber', icon: <AlertTriangle style={{ width: 18, height: 18 }} />, title: 'DM delivery status unavailable', body: 'HeyLaunch could not verify its delivery worker. Try refreshing shortly; contact support if this continues.', href: '/dashboard/help' });
  }

  return (
    <div>
      <PageHead title="Notifications" sub="Current connection and automation status, including expiring tokens and issues that may need attention." />
      {loading ? <div style={{ display: 'grid', gap: 10 }}>{[0, 1].map((i) => <Skel key={i} h={72} />)}</div>
        : failed ? (
          <Card style={{ padding: 24, textAlign: 'center' }}>
            <AlertTriangle style={{ width: 24, height: 24, color: 'var(--warning)', margin: '0 auto 10px' }} aria-hidden />
            <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 17 }}>Could not check your latest status</h2>
            <p role="alert" style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.5, margin: '8px auto 14px', maxWidth: 440 }}>
              We could not load {autos.isError && igs.isError ? 'your automation and Instagram account status' : autos.isError ? 'your automation status' : 'your Instagram account status'}. Some issues may not appear until the check succeeds.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <Btn variant="ghost" onClick={() => { void Promise.all([autos.refetch(), igs.refetch()]); }} disabled={autos.isFetching || igs.isFetching}>
                <RefreshCw style={{ width: 14, height: 14 }} aria-hidden /> Try again
              </Btn>
              {autos.isError && <Btn variant="ghost" href="/dashboard/automations">Automations</Btn>}
              {igs.isError && <Btn variant="ghost" href="/dashboard/instagram">Instagram</Btn>}
            </div>
          </Card>
        )
        : notes.length === 0 ? (
          <Empty icon={<CheckCircle2 style={{ width: 24, height: 24 }} />} title="All clear" sub="No account connection or automation issues were found in this live status check." />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {notes.map((n, i) => (
              <Link key={i} href={n.href} style={{ textDecoration: 'none' }}>
                <Card pad={16} hover>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center',
                      background: n.tone === 'coral' ? RL.coralSoft : n.tone === 'amber' ? RL.amberSoft : RL.greenSoft,
                      color: n.tone === 'coral' ? RL.coral : n.tone === 'amber' ? RL.amber : RL.green }}>{n.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 650, color: RL.ink }}>{n.title}</span>
                        <Pill tone={n.tone}>{n.tone === 'coral' ? 'action needed' : n.tone === 'amber' ? 'warning' : 'ok'}</Pill>
                      </div>
                      <div style={{ fontSize: 13.5, color: RL.muted, marginTop: 4 }}>{n.body}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
