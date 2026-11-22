'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instagramApi, paymentApi } from '../../../../services/api';
import { RL, Card, Pill, Btn, Empty, Skel, PageHead } from '../../../../components/rl-kit';
import { Instagram, Plus, AlertCircle, Unlink, CheckCircle2, X, Sparkles, Lock } from 'lucide-react';

type IgAccount = { id: string; username: string; igUserId: string; isActive: boolean; tokenExpiresAt?: string; webhookSubscribedAt?: string | null; lastWebhookAt?: string | null };

export default function InstagramPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (params.get('connected')) {
      setBanner(params.get('webhook_error')
        ? { tone: 'error', msg: 'Account connected, but Meta did not confirm comment and message webhooks. Set them up below before enabling comment automations.' }
        : { tone: 'success', msg: 'Instagram account connected and webhooks confirmed.' });
      router.replace('/dashboard/instagram');
    }
    const err = params.get('error');
    if (err) { setBanner({ tone: 'error', msg: decodeURIComponent(err) }); router.replace('/dashboard/instagram'); }
  }, [params, router]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ig-accounts'], queryFn: async () => (await instagramApi.accounts()).data.data as IgAccount[],
    refetchInterval: 30_000, refetchIntervalInBackground: false,
  });
  const { data: loginOptions, isError: loginOptionsError } = useQuery({
    queryKey: ['instagram-login-options'], queryFn: async () => (await instagramApi.loginOptions()).data.data as { unifiedLoginEnabled: boolean; webhookCallbackUrl: string },
  });
  const sub = useQuery({
    queryKey: ['subscription'], queryFn: async () => (await paymentApi.getSubscription()).data.data as { plan: string; name: string; active: boolean; limits: { accountCap: number } },
  });

  const connect = useMutation({
    mutationFn: async (mode: 'INSTAGRAM_LOGIN' | 'UNIFIED_LOGIN') => (await instagramApi.getAuthUrl(mode)).data.data.url as string,
    onSuccess: (url) => { window.location.href = url; },
    onError: () => setBanner({ tone: 'error', msg: 'Could not start the connect flow. Please try again.' }),
  });
  const disconnect = useMutation({
    mutationFn: (id: string) => instagramApi.disconnect(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ig-accounts'] }); setBanner({ tone: 'success', msg: 'Instagram account disconnected.' }); },
    onError: () => setBanner({ tone: 'error', msg: 'Could not disconnect. Please try again.' }),
  });
  const subscribeWebhooks = useMutation({
    mutationFn: (id: string) => instagramApi.subscribeWebhooks(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ig-accounts'] });
      setBanner({ tone: 'success', msg: 'Instagram comment and message webhooks are set up.' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message;
      setBanner({
        tone: 'error',
        msg: typeof message === 'string'
          ? message
          : 'Meta could not confirm webhook setup. Check the app-level webhook fields, granted permissions, and account eligibility, then retry.',
      });
    },
  });

  const active = (data ?? []).filter((a) => a.isActive);
  const planName = sub.data?.name ?? 'Free';
  const isPaidPlan = (sub.data?.plan ?? 'free') !== 'free';
  const cap = sub.data?.limits?.accountCap ?? 1;
  const canAddMore = active.length < cap;

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHead title="Instagram" sub={`Connect the professional accounts your automations run on. ${isPaidPlan ? `${planName}: up to ${cap} accounts.` : `Free: ${cap} account — upgrade for more.`}`} />

      {active.length > 0 && !active.every((account) => account.lastWebhookAt) && (
        <Card pad={16} style={{ marginBottom: 14, borderColor: `${RL.amber}66`, background: `${RL.amber}0b` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertCircle style={{ width: 18, height: 18, flex: '0 0 auto', color: RL.amber, marginTop: 1 }} aria-hidden />
            <div style={{ minWidth: 0 }}>
              <strong style={{ color: RL.ink, fontSize: 14 }}>Finish Meta webhook setup before relying on automations</strong>
              <p style={{ color: RL.muted, fontSize: 13, lineHeight: 1.55, margin: '6px 0 8px' }}>
                Configure this callback and the comments and messages fields once in Meta Developers. Then use “Set up webhooks” once for each connected professional account; HeyLaunch remembers a successful account subscription and offers setup again if it fails. The callback must be publicly reachable over HTTPS. Meta sends comment notifications only for media owned by public accounts. For production delivery, the app must be Live with the required access for these fields, and you should confirm delivery with an authorized test event.
              </p>
              <code style={{ display: 'block', overflowWrap: 'anywhere', color: RL.ink, fontSize: 12.5, padding: '9px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                {loginOptions?.webhookCallbackUrl ?? (loginOptionsError || loginOptions ? 'Callback URL unavailable. Check the backend PUBLIC_URL configuration.' : 'Loading callback URL…')}
              </code>
              <a href="https://developers.facebook.com/documentation/instagram-platform/webhooks/setup" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, color: RL.teal, fontSize: 12.5, fontWeight: 600 }}>
                Open Meta’s webhook setup guide
              </a>
            </div>
          </div>
        </Card>
      )}

      {banner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, padding: '12px 16px', borderRadius: 12,
          background: banner.tone === 'success' ? 'var(--success-soft)' : 'var(--error-soft)', color: banner.tone === 'success' ? 'var(--success)' : 'var(--error)', border: `1px solid ${banner.tone === 'success' ? 'var(--success-soft)' : 'var(--error-soft)'}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 600 }}>
            {banner.tone === 'success' ? <CheckCircle2 style={{ width: 17, height: 17 }} /> : <AlertCircle style={{ width: 17, height: 17 }} />}{banner.msg}
          </span>
          <button onClick={() => setBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.7, display: 'grid', placeItems: 'center' }}><X style={{ width: 15, height: 15 }} /></button>
        </div>
      )}

      {isLoading && <Skel h={96} />}
      {isError && <Empty icon={<AlertCircle style={{ width: 24, height: 24 }} />} title="Couldn’t load your accounts" sub="Something went wrong talking to the server." />}

      {data && active.length === 0 && (
        <Empty icon={<Instagram style={{ width: 24, height: 24 }} />} title="No account connected"
          sub="Connect an Instagram professional (Business or Creator) account to start sending auto-DMs."
          action={<div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            <Btn variant="accent" disabled={connect.isPending} onClick={() => connect.mutate('INSTAGRAM_LOGIN')}><Instagram style={{ width: 16, height: 16 }} /> {connect.isPending ? 'Opening…' : 'Connect Instagram'}</Btn>
            {loginOptions?.unifiedLoginEnabled && <Btn variant="ghost" disabled={connect.isPending} onClick={() => connect.mutate('UNIFIED_LOGIN')}>Connect with Meta Unified Login</Btn>}
          </div>} />
      )}

      {data && active.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {active.map((a) => (
            <Card key={a.id} pad={16}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: RL.tealSoft, color: RL.teal, display: 'grid', placeItems: 'center' }}><Instagram style={{ width: 20, height: 20 }} /></div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 650, color: RL.ink }}>@{a.username}</div>
                    <div style={{ marginTop: 4 }}><Pill tone="green" dot>connected</Pill></div>
                  </div>
                </div>
                <Btn variant="ghost" disabled={disconnect.isPending} onClick={() => disconnect.mutate(a.id)}><Unlink style={{ width: 15, height: 15 }} /> Disconnect</Btn>
              </div>
              <div role="status" style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <span style={{ fontSize: 13, color: RL.muted }}>
                  {!a.webhookSubscribedAt
                    ? 'Account webhook subscription is not confirmed. Set it up, then verify live delivery with a test comment before relying on automations.'
                    : !a.lastWebhookAt
                      ? 'Account subscription succeeded, but HeyLaunch has not received a webhook event yet. Confirm Meta App Dashboard fields and permissions, then run a controlled comment or message test.'
                      : `Last webhook event received ${new Date(a.lastWebhookAt).toLocaleString()}. Live delivery still depends on Meta permissions and account eligibility.`}
                </span>
                {!a.webhookSubscribedAt && <Btn variant="ghost" disabled={subscribeWebhooks.isPending} onClick={() => subscribeWebhooks.mutate(a.id)}>{subscribeWebhooks.isPending ? 'Setting up…' : 'Set up webhooks'}</Btn>}
              </div>
            </Card>
          ))}

          {/* Plan-aware add-account area */}
          <div style={{ fontSize: 12.5, color: RL.muted, marginTop: 2 }}>{active.length} of {cap} account{cap > 1 ? 's' : ''} used ({planName})</div>

          {canAddMore ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Btn variant="ghost" disabled={connect.isPending} onClick={() => connect.mutate('INSTAGRAM_LOGIN')}><Plus style={{ width: 16, height: 16 }} /> {connect.isPending ? 'Opening…' : 'Connect another account'}</Btn>
              {loginOptions?.unifiedLoginEnabled && <Btn variant="ghost" disabled={connect.isPending} onClick={() => connect.mutate('UNIFIED_LOGIN')}>Connect with Meta Unified Login</Btn>}
            </div>
          ) : !isPaidPlan || cap < 15 ? (
            <Card pad={18} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--nav-selected)', border: '1px solid var(--border)', color: 'var(--text)', display: 'grid', placeItems: 'center' }}><Lock style={{ width: 18, height: 18 }} /></div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 650, color: RL.ink }}>Need more connected accounts?</div>
                  <div style={{ fontSize: 13, color: RL.muted, marginTop: 2 }}>Your {planName} plan includes {cap} account{cap > 1 ? 's' : ''}. Upgrade for more.</div>
                </div>
              </div>
              <Link href="/dashboard/billing" style={{ textDecoration: 'none' }}><Btn variant="accent"><Sparkles style={{ width: 15, height: 15 }} /> Upgrade</Btn></Link>
            </Card>
          ) : (
            <div style={{ fontSize: 13, color: RL.muted }}>You’ve reached your {planName} limit of {cap} connected accounts.</div>
          )}
        </div>
      )}
    </div>
  );
}
