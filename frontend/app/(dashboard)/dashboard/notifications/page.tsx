'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { automationApi, instagramApi } from '../../../../services/api';
import { RL, Card, Pill, Empty, Skel, PageHead } from '../../../../components/rl-kit';
import { Bell, AlertTriangle, CheckCircle2, Instagram, Zap } from 'lucide-react';

type Automation = { id: string; name: string; status: string; health?: { level: string; label: string } };
type IgAccount = { id: string; username: string; isActive: boolean; tokenExpiresAt?: string };

export default function NotificationsPage() {
  const autos = useQuery({ queryKey: ['automations'], queryFn: async () => (await automationApi.list()).data.data as Automation[] });
  const igs = useQuery({ queryKey: ['ig-accounts'], queryFn: async () => (await instagramApi.accounts()).data.data as IgAccount[] });
  const loading = autos.isLoading || igs.isLoading;

  type Note = { tone: 'coral' | 'amber' | 'green'; icon: React.ReactNode; title: string; body: string; href: string };
  const notes: Note[] = [];

  (autos.data ?? []).forEach((a) => {
    if (a.health && a.health.level === 'needs_reconnect')
      notes.push({ tone: 'coral', icon: <AlertTriangle style={{ width: 18, height: 18 }} />, title: `${a.name} stopped sending`, body: a.health.label + ' — reconnect to resume delivery.', href: `/dashboard/automations/${a.id}` });
    else if (a.health && a.health.level === 'at_risk')
      notes.push({ tone: 'amber', icon: <AlertTriangle style={{ width: 18, height: 18 }} />, title: `${a.name} needs a look`, body: a.health.label, href: `/dashboard/automations/${a.id}` });
  });
  (igs.data ?? []).filter((a) => a.isActive && a.tokenExpiresAt).forEach((a) => {
    const days = Math.ceil((new Date(a.tokenExpiresAt!).getTime() - Date.now()) / 86400000);
    if (days <= 7) notes.push({ tone: days <= 2 ? 'coral' : 'amber', icon: <Instagram style={{ width: 18, height: 18 }} />, title: `@${a.username} token expiring`, body: `Your Instagram connection expires in ${days} day${days === 1 ? '' : 's'}. Reconnect to avoid downtime.`, href: '/dashboard/instagram' });
  });
  if ((igs.data ?? []).filter((a) => a.isActive).length === 0 && !loading)
    notes.push({ tone: 'amber', icon: <Instagram style={{ width: 18, height: 18 }} />, title: 'No Instagram connected', body: 'Connect an account to start running automations.', href: '/dashboard/instagram' });

  return (
    <div>
      <PageHead title="Notifications" sub="Everything that needs your attention — connection breaks, expiring tokens, and automations at risk." />
      {loading ? <div style={{ display: 'grid', gap: 10 }}>{[0, 1].map((i) => <Skel key={i} h={72} />)}</div>
        : notes.length === 0 ? (
          <Empty icon={<CheckCircle2 style={{ width: 24, height: 24 }} />} title="All clear" sub="No alerts right now. We’ll notify you the moment an automation breaks or a token is about to expire." />
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
