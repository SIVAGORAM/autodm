'use client';

import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { automationApi, instagramApi } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { RL, Card, Stat, Pill, Btn, Empty, Skel } from '../../../components/rl-kit';
import { Send, Instagram, Zap, Activity, Plus, ArrowRight, AlertTriangle } from 'lucide-react';

type Automation = {
  id: string; name: string; triggerType: string; status: 'DRAFT' | 'LIVE' | 'PAUSED';
  keywords: string[]; _count?: { runs: number }; health?: { level: string; label: string };
};
type IgAccount = { id: string; username: string; isActive: boolean };

const triggerLabels: Record<string, string> = {
  POST_COMMENT: 'Post / Reel comment', NEXT_POST: 'Next post', ANY_POST: 'Any post',
  STORY_REPLY: 'Story reply', LIVE_COMMENT: 'Live comment', DM: 'Incoming DM',
};
const healthTone = (l?: string) => l === 'healthy' ? 'green' : l === 'needs_reconnect' ? 'coral' : l === 'at_risk' ? 'amber' : 'muted';
const statusTone = (s: string) => s === 'LIVE' ? 'green' : s === 'PAUSED' ? 'amber' : 'muted';

export default function Overview() {
  const { user } = useAuthStore();
  const autos = useQuery({ queryKey: ['automations'], queryFn: async () => (await automationApi.list()).data.data as Automation[] });
  const igs = useQuery({ queryKey: ['ig-accounts'], queryFn: async () => (await instagramApi.accounts()).data.data as IgAccount[] });

  const connect = useMutation({
    mutationFn: async () => (await instagramApi.getAuthUrl()).data.data.url as string,
    onSuccess: (url) => { window.location.href = url; },
  });

  const list = autos.data ?? [];
  const activeIg = (igs.data ?? []).filter((a) => a.isActive);
  const live = list.filter((a) => a.status === 'LIVE').length;
  const totalRuns = list.reduce((s, a) => s + (a._count?.runs ?? 0), 0);
  const needsAttention = list.filter((a) => a.health && a.health.level !== 'healthy' && a.status !== 'DRAFT');

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const loading = autos.isLoading || igs.isLoading;

  return (
    <div>
      {/* greeting */}
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1.1px', color: RL.ink, margin: 0 }}>
          {greet}, {user?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p style={{ color: RL.muted, fontSize: 15.5, marginTop: 6 }}>
          {live > 0 ? `${live} automation${live > 1 ? 's' : ''} live and watching your comments.` : 'Here’s where your Instagram automation stands today.'}
        </p>
      </div>

      {/* connect-IG banner */}
      {!loading && activeIg.length === 0 && (
        <Card pad={0} style={{ marginBottom: 20, borderColor: RL.coralSoft, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 20, background: `linear-gradient(90deg, ${RL.coralSoft}66, #fff 60%)`, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', border: `1px solid ${RL.coralSoft}`, display: 'grid', placeItems: 'center', color: RL.coral }}><Instagram style={{ width: 22, height: 22 }} /></div>
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 650, color: RL.ink }}>Connect your Instagram account</div>
                <div style={{ fontSize: 13.5, color: RL.muted, marginTop: 2 }}>Link a professional account to start auto-DMing comment replies.</div>
              </div>
            </div>
            <Btn variant="accent" disabled={connect.isPending} onClick={() => connect.mutate()}>
              {connect.isPending ? 'Opening…' : <>Connect <ArrowRight style={{ width: 16, height: 16 }} /></>}
            </Btn>
          </div>
        </Card>
      )}

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {loading ? [0, 1, 2, 3].map((i) => <Skel key={i} h={112} />) : <>
          <Stat label="Automations" value={list.length} delta={`${list.length - live} draft/paused`} icon={<Zap style={{ width: 18, height: 18 }} />} />
          <Stat label="Live now" value={live} delta={live > 0 ? 'actively sending' : 'none live yet'} icon={<Activity style={{ width: 18, height: 18 }} />} />
          <Stat label="DMs sent" value={totalRuns.toLocaleString()} delta="all time" icon={<Send style={{ width: 18, height: 18 }} />} />
          <Stat label="Instagram" value={activeIg.length || '—'} delta={activeIg.length ? `@${activeIg[0].username}` : 'not connected'} icon={<Instagram style={{ width: 18, height: 18 }} />} />
        </>}
      </div>

      {/* needs attention */}
      {needsAttention.length > 0 && (
        <Card style={{ marginBottom: 20, borderColor: RL.coralSoft, background: `linear-gradient(90deg, ${RL.coralSoft}44, #fff 50%)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertTriangle style={{ width: 17, height: 17, color: RL.coral }} />
            <span style={{ fontWeight: 650, fontSize: 15, color: RL.ink }}>Needs your attention</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {needsAttention.map((a) => (
              <Link key={a.id} href={`/dashboard/automations/${a.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${RL.line}`, textDecoration: 'none' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: RL.ink }}>{a.name}</span>
                <Pill tone={healthTone(a.health?.level)} dot>{a.health?.label}</Pill>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* automations panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: RL.ink, margin: 0 }}>Your automations</h2>
        <Link href="/dashboard/automations/new" style={{ textDecoration: 'none' }}><Btn><Plus style={{ width: 16, height: 16 }} /> New automation</Btn></Link>
      </div>

      {loading ? <div style={{ display: 'grid', gap: 10 }}>{[0, 1].map((i) => <Skel key={i} h={68} />)}</div>
        : list.length === 0 ? (
          <Empty icon={<Send style={{ width: 24, height: 24 }} />} title="No automations yet"
            sub="Create one and every matching comment gets an instant DM with your link — tracked and logged."
            action={<Link href="/dashboard/automations/new" style={{ textDecoration: 'none' }}><Btn variant="accent"><Plus style={{ width: 16, height: 16 }} /> Create your first automation</Btn></Link>} />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {list.map((a) => (
              <Card key={a.id} pad={16} hover onClick={() => { window.location.href = `/dashboard/automations/${a.id}`; }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 650, color: RL.ink }}>{a.name}</span>
                      <Pill tone={statusTone(a.status)}>{a.status.toLowerCase()}</Pill>
                      {a.health && <Pill tone={healthTone(a.health.level)} dot>{a.health.label}</Pill>}
                    </div>
                    <div style={{ fontSize: 13, color: RL.muted, marginTop: 4 }}>
                      {triggerLabels[a.triggerType] ?? a.triggerType}{a.keywords.length > 0 && ` · ${a.keywords.join(', ')}`} · {a._count?.runs ?? 0} runs
                    </div>
                  </div>
                  <ArrowRight style={{ width: 18, height: 18, color: RL.faint, flexShrink: 0 }} />
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
