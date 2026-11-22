'use client';

import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { automationApi, healthApi, instagramApi, paymentApi } from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';
import { RL, Card, Stat, Pill, Btn, Empty, Skel } from '../../../components/rl-kit';
import { Send, Instagram, Zap, Activity, Plus, ArrowRight, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';

type Automation = {
  id: string; name: string; triggerType: string; status: 'DRAFT' | 'LIVE' | 'PAUSED';
  keywords: string[]; sentCount?: number; _count?: { runs: number }; health?: { level: string; label: string };
};
type IgAccount = { id: string; username: string; isActive: boolean; webhookSubscribedAt?: string | null };
type WorkerStatus = { status: 'ok' | 'stale' | 'unavailable'; lastHeartbeatAt: string | null };
type Subscription = {
  name: string;
  limits: { accountCap: number; dmQuota: number };
  usage: { accountsUsed: number; dmUsed: number; dmResetAt: string | null };
};

const triggerLabels: Record<string, string> = {
  POST_COMMENT: 'Post comment', NEXT_POST: 'Next post (legacy)', ANY_POST: 'Any post',
  STORY_REPLY: 'Story reply', LIVE_COMMENT: 'Live comment', DM: 'Incoming DM',
};
const healthTone = (l?: string) => l === 'healthy' ? 'green' : l === 'needs_reconnect' ? 'coral' : l === 'at_risk' ? 'amber' : 'muted';
const statusTone = (s: string) => s === 'LIVE' ? 'green' : s === 'PAUSED' ? 'amber' : 'muted';

export default function Overview() {
  const { user } = useAuthStore();
  const autos = useQuery({ queryKey: ['automations'], queryFn: async () => (await automationApi.list()).data.data as Automation[], refetchInterval: 30_000, refetchIntervalInBackground: false });
  const igs = useQuery({ queryKey: ['ig-accounts'], queryFn: async () => (await instagramApi.accounts()).data.data as IgAccount[], refetchInterval: 30_000, refetchIntervalInBackground: false });
  const worker = useQuery({
    queryKey: ['creator-worker-status'],
    queryFn: async () => (await healthApi.workerStatus()).data.data as WorkerStatus,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => (await paymentApi.getSubscription()).data.data as Subscription,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const connect = useMutation({
    mutationFn: async () => (await instagramApi.getAuthUrl()).data.data.url as string,
    onSuccess: (url) => { window.location.href = url; },
    onError: () => toast.error('Could not start Instagram connection. Please try again.'),
  });

  const list = autos.data ?? [];
  const activeIg = (igs.data ?? []).filter((a) => a.isActive);
  const live = list.filter((a) => a.status === 'LIVE').length;
  const totalSent = list.reduce((s, a) => s + (a.sentCount ?? 0), 0);
  const needsAttention = list.filter((a) => a.health && a.health.level !== 'healthy' && a.status !== 'DRAFT');

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const loading = autos.isLoading || igs.isLoading || worker.isLoading;
  const hasRun = list.some((automation) => (automation._count?.runs ?? 0) > 0);
  const webhooksReady = activeIg.length > 0 && activeIg.every((account) => Boolean(account.webhookSubscribedAt));
  const workerReady = worker.data?.status === 'ok';
  const workerStatusTitle = worker.isLoading
    ? 'Checking delivery worker status'
    : workerReady
      ? 'Delivery worker is online'
      : worker.isError || worker.data?.status === 'unavailable'
        ? 'Check delivery worker status'
        : 'Confirm delivery worker is online';
  const setupSteps = [
    {
      title: activeIg.length > 0 ? 'Confirm comment and message webhooks' : 'Connect a professional Instagram account',
      done: webhooksReady,
      enabled: true,
      href: '/dashboard/instagram',
    },
    { title: 'Create your first comment-to-DM automation', done: list.length > 0, enabled: webhooksReady, href: '/dashboard/automations/new' },
    { title: workerStatusTitle, done: workerReady, enabled: list.length > 0 && webhooksReady, href: '/dashboard/notifications' },
    { title: 'Set an automation live', done: live > 0, enabled: list.length > 0 && webhooksReady && workerReady, href: list[0] ? `/dashboard/automations/${list[0].id}` : '/dashboard/automations/new' },
    { title: 'Review activity in your delivery logs', done: hasRun, enabled: live > 0 && webhooksReady, href: '/dashboard/logs' },
  ];
  const showSetup = !loading && !autos.isError && !igs.isError && setupSteps.some((step) => !step.done);
  const hasLoadError = autos.isError || igs.isError || subscription.isError || worker.isError;
  const usage = subscription.data;
  const dmPercent = usage ? Math.min(100, Math.round((usage.usage.dmUsed / Math.max(1, usage.limits.dmQuota)) * 100)) : 0;
  const dmNearLimit = !!usage && dmPercent >= 80;
  const dmLimitReached = !!usage && usage.usage.dmUsed >= usage.limits.dmQuota;
  const accountLimitReached = !!usage && usage.usage.accountsUsed >= usage.limits.accountCap;

  return (
    <div>
      {/* greeting */}
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1.1px', color: RL.ink, margin: 0 }}>
          {greet}, {user?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p style={{ color: RL.muted, fontSize: 15.5, marginTop: 6 }}>
          {live > 0 ? `${live} automation${live > 1 ? 's' : ''} set to Live. Check their health to confirm delivery.` : 'Here’s where your Instagram automation stands today.'}
        </p>
      </div>

      {hasLoadError && (
        <Card style={{ marginBottom: 20, borderColor: 'var(--error)' }}>
          <div role="alert" style={{ color: RL.ink, fontSize: 14, lineHeight: 1.5 }}>
            Some dashboard data could not be loaded. Any figures still shown may be the last successful results.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {autos.isError && <Btn variant="ghost" onClick={() => void autos.refetch()}>Retry automations</Btn>}
            {igs.isError && <Btn variant="ghost" onClick={() => void igs.refetch()}>Retry Instagram status</Btn>}
            {subscription.isError && <Btn variant="ghost" onClick={() => void subscription.refetch()}>Retry plan usage</Btn>}
            {worker.isError && <Btn variant="ghost" onClick={() => void worker.refetch()}>Retry delivery status</Btn>}
          </div>
        </Card>
      )}

      {showSetup && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: RL.ink }}>Get your first automation running</div>
            <div style={{ fontSize: 13.5, color: RL.muted, marginTop: 3 }}>Follow these steps to connect Instagram, go live, and review what happened.</div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {setupSteps.map((step, index) => {
              const content = (
                <>
                  {step.done
                    ? <CheckCircle2 style={{ width: 19, height: 19, color: 'var(--success)', flexShrink: 0 }} />
                    : <Circle style={{ width: 19, height: 19, color: step.enabled ? RL.teal : RL.faint, flexShrink: 0 }} />}
                  <span style={{ flex: 1, color: step.done ? RL.muted : RL.ink, fontSize: 14, fontWeight: step.done ? 500 : 600 }}>{index + 1}. {step.title}</span>
                  {!step.done && step.enabled && <ArrowRight style={{ width: 16, height: 16, color: RL.faint, flexShrink: 0 }} />}
                  {!step.done && !step.enabled && <span style={{ fontSize: 12, color: RL.faint }}>Complete the step above first</span>}
                </>
              );
              const rowStyle: React.CSSProperties = {
                display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '10px 12px',
                borderRadius: 10, border: '1px solid var(--border)', background: step.done ? 'var(--card-hover)' : 'var(--surface)',
                textDecoration: 'none', cursor: step.enabled && !step.done ? 'pointer' : 'default',
              };
              if (step.done || !step.enabled) return <div key={step.title} aria-disabled={!step.enabled} style={{ ...rowStyle, opacity: step.enabled ? 0.78 : 0.58 }}>{content}</div>;
              if (index === 0 && activeIg.length === 0) return <button key={step.title} type="button" onClick={() => connect.mutate()} disabled={connect.isPending} style={{ ...rowStyle, width: '100%', textAlign: 'left', fontFamily: 'inherit' }}>{content}</button>;
              return <Link key={step.title} href={step.href} style={rowStyle}>{content}</Link>;
            })}
          </div>
        </Card>
      )}

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 16, marginBottom: 20 }}>
        {loading ? [0, 1, 2, 3].map((i) => <Skel key={i} h={112} />) : <>
          <Stat label="Automations" value={autos.isError && !autos.data ? '—' : list.length} delta={autos.isError && !autos.data ? 'could not load' : `${list.length - live} draft/paused`} icon={<Zap style={{ width: 18, height: 18 }} />} />
          <Stat label="Set to Live" value={autos.isError && !autos.data ? '—' : live} delta={autos.isError && !autos.data ? 'could not load' : live > 0 ? 'health shown below' : 'none enabled yet'} icon={<Activity style={{ width: 18, height: 18 }} />} />
          <Stat label="DMs sent" value={autos.isError && !autos.data ? '—' : totalSent.toLocaleString()} delta={autos.isError && !autos.data ? 'could not load' : 'all time'} icon={<Send style={{ width: 18, height: 18 }} />} />
          <Stat label="Instagram" value={igs.isError && !igs.data ? '—' : activeIg.length || '—'} delta={igs.isError && !igs.data ? 'could not load' : activeIg.length ? `@${activeIg[0].username}` : 'not connected'} icon={<Instagram style={{ width: 18, height: 18 }} />} />
        </>}
      </div>

      {usage && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: RL.ink }}>{usage.name} plan usage</div>
              <div style={{ fontSize: 13, color: RL.muted, marginTop: 3 }}>
                DMs this month: {usage.usage.dmUsed.toLocaleString('en-IN')} / {usage.limits.dmQuota.toLocaleString('en-IN')}
                {usage.usage.dmResetAt && ` · Resets ${new Date(usage.usage.dmResetAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                <span style={{ display: 'block', marginTop: 3 }}>Active Instagram accounts: {usage.usage.accountsUsed} / {usage.limits.accountCap}</span>
              </div>
            </div>
            <Link href="/dashboard/billing" style={{ fontSize: 13, fontWeight: 600, color: RL.teal, textDecoration: 'none' }}>Plans & usage <ArrowRight style={{ width: 14, height: 14, verticalAlign: 'middle' }} /></Link>
          </div>
          <div role="progressbar" aria-label="Monthly DM quota" aria-valuemin={0} aria-valuemax={usage.limits.dmQuota} aria-valuenow={Math.min(usage.usage.dmUsed, usage.limits.dmQuota)} style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: RL.line }}>
            <div style={{ width: `${dmPercent}%`, height: '100%', borderRadius: 999, background: dmLimitReached ? 'var(--error)' : dmNearLimit ? 'var(--warning)' : 'var(--lime)', transition: 'width .25s ease' }} />
          </div>
          {(dmNearLimit || accountLimitReached) && (
            <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, color: dmLimitReached || accountLimitReached ? 'var(--error)' : 'var(--warning)', fontSize: 13.5, lineHeight: 1.5 }}>
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
              <span>{dmLimitReached ? 'Your monthly DM limit is reached. New matching events may be skipped until the quota resets or you move to a plan with a higher limit.' : dmNearLimit ? 'You are close to your monthly DM limit.' : ''}{accountLimitReached ? `${dmLimitReached ? ' ' : ''}You are also at your Instagram account limit; upgrade or disconnect an account before linking another.` : ''}</span>
            </div>
          )}
        </Card>
      )}

      {/* needs attention */}
      {needsAttention.length > 0 && (
        <Card style={{ marginBottom: 20, borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertTriangle style={{ width: 17, height: 17, color: 'var(--warning)' }} />
            <span style={{ fontWeight: 650, fontSize: 15, color: RL.ink }}>Needs your attention</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {needsAttention.map((a) => (
              <Link key={a.id} href={`/dashboard/automations/${a.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none' }}>
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
        : autos.isError && !autos.data ? (
          <Card style={{ borderColor: 'var(--error)' }}>
            <p role="alert" style={{ color: RL.ink, margin: '0 0 12px', fontSize: 14 }}>Could not load your automations. Your saved rules have not been changed.</p>
            <Btn variant="ghost" onClick={() => void autos.refetch()}>Try again</Btn>
          </Card>
        )
        : list.length === 0 ? (
          <Empty icon={<Send style={{ width: 24, height: 24 }} />} title="No automations yet"
            sub="Create a rule to send a prepared DM to matching comments, then review each delivery outcome in your logs."
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
