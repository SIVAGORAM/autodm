'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApiErrorMessage, instagramApi, paymentApi } from '../../../../services/api';
import { AUTH_URL_MISMATCH, LOGIN_OPTIONS_INCOMPLETE, parseInstagramLoginOptions, validateMetaAuthorizationUrl } from '../../../../lib/instagram-login-config.cjs';
import { RL, Card, Pill, Btn, Empty, Skel, PageHead } from '../../../../components/rl-kit';
import { Instagram, Plus, AlertCircle, Unlink, CheckCircle2, X, Sparkles, Lock } from 'lucide-react';

type LoginMode = 'INSTAGRAM_LOGIN' | 'UNIFIED_LOGIN';
type IgAccount = { id: string; username: string; igUserId: string; isActive: boolean; loginMode: LoginMode; tokenExpiresAt?: string; webhookSubscribedAt?: string | null; webhookFields?: string[]; lastWebhookAt?: string | null };

function getTokenExpiry(expiresAt: string | undefined, now: number) {
  if (!expiresAt) return null;
  const timestamp = Date.parse(expiresAt);
  if (!Number.isFinite(timestamp)) return null;
  const millisecondsRemaining = timestamp - now;
  return {
    date: new Date(timestamp).toLocaleDateString(),
    daysRemaining: Math.ceil(millisecondsRemaining / 86_400_000),
    isExpired: millisecondsRemaining <= 0,
  };
}

function TokenExpiryNotice({
  account,
  unifiedLoginEnabled,
  isConnecting,
  onReconnect,
}: {
  account: IgAccount;
  unifiedLoginEnabled: boolean;
  isConnecting: boolean;
  onReconnect: () => void;
}) {
  // Keep date-dependent markup client-only so server and browser clocks/time
  // zones cannot produce a hydration mismatch around midnight or expiry.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const expiry = now === null ? null : getTokenExpiry(account.tokenExpiresAt, now);
  if (!expiry || expiry.daysRemaining > 7) return null;

  const isExpired = expiry.isExpired;
  const canReconnect = account.loginMode === 'INSTAGRAM_LOGIN' || unifiedLoginEnabled;
  const remaining = expiry.daysRemaining === 0
    ? 'today'
    : `in ${expiry.daysRemaining} day${expiry.daysRemaining === 1 ? '' : 's'}`;
  const message = isExpired
    ? `Meta reported this connection token expired on ${expiry.date}. Reconnect to restore automation access.`
    : account.loginMode === 'UNIFIED_LOGIN'
      ? `Meta reports this token expires ${remaining} (${expiry.date}). Reconnect before expiry to avoid interruption.`
      : `This token expires ${remaining} (${expiry.date}). HeyLaunch attempts scheduled refresh for Instagram Login tokens; reconnect if refresh fails.`;

  return (
    <div role="alert" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', border: `1px solid ${RL.amber}55`, borderRadius: 10, padding: '10px 12px', background: `${RL.amber}0b` }}>
      <span style={{ minWidth: 0, fontSize: 13, lineHeight: 1.5, color: RL.ink }}>{message}</span>
      {canReconnect
        ? <Btn variant="ghost" disabled={isConnecting} onClick={onReconnect}>{isConnecting ? 'Opening…' : 'Reconnect account'}</Btn>
        : <span style={{ fontSize: 12.5, color: RL.muted }}>Unified Login reconnect is currently disabled. Contact your workspace administrator.</span>}
    </div>
  );
}

export default function InstagramPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  useEffect(() => {
    if (params.get('connected')) {
      setBanner(params.get('webhook_error')
        ? { tone: 'error', msg: 'Account connected, but Meta did not confirm comment and message webhooks. Set them up below before enabling comment automations.' }
        : { tone: 'success', msg: 'Instagram connected and Meta accepted the webhook subscription. Send a controlled test comment or message to confirm live delivery.' });
      router.replace('/dashboard/instagram');
    }
    const err = params.get('error');
    if (err) {
      setBanner({
        tone: 'error',
        msg: err === 'cancelled'
          ? 'Instagram connection was cancelled. You can start again whenever you’re ready.'
          : 'We couldn’t connect Instagram. Check the Meta login configuration and that the account is professional, then try again.',
      });
      router.replace('/dashboard/instagram');
    }
  }, [params, router]);

  useEffect(() => {
    // Keep connection/configuration errors visible until the creator dismisses
    // them. Success notices can remain brief; OAuth failures often need a
    // follow-up check of the Meta app settings shown on this page.
    if (!banner || banner.tone === 'error') return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ig-accounts'], queryFn: async () => (await instagramApi.accounts()).data.data as IgAccount[],
    refetchInterval: 30_000, refetchIntervalInBackground: false,
  });
  const { data: loginOptions, isError: loginOptionsFailed, error: loginOptionsError, refetch: refetchLoginOptions } = useQuery({
    queryKey: ['instagram-login-options'], queryFn: async () => {
      const response = await instagramApi.loginOptions();
      return parseInstagramLoginOptions(response.data?.data);
    },
  });
  const sub = useQuery({
    queryKey: ['subscription'], queryFn: async () => (await paymentApi.getSubscription()).data.data as { plan: string; name: string; active: boolean; limits: { accountCap: number } },
  });

  const connect = useMutation({
    mutationFn: async (mode: 'INSTAGRAM_LOGIN' | 'UNIFIED_LOGIN') => {
      const options = loginOptions ?? parseInstagramLoginOptions((await instagramApi.loginOptions()).data?.data);
      const response = await instagramApi.getAuthUrl(mode);
      return validateMetaAuthorizationUrl(response.data?.data?.url, mode, options, window.location.origin);
    },
    onSuccess: (url) => { window.location.href = url; },
    onError: (error) => setBanner({
      tone: 'error',
      msg: error instanceof Error && error.message === AUTH_URL_MISMATCH
        ? error.message
        : getApiErrorMessage(error, 'Could not start the connect flow. Check the Meta login configuration and try again.'),
    }),
  });
  const disconnect = useMutation({
    mutationFn: (id: string) => instagramApi.disconnect(id),
    onMutate: (id) => setDisconnectingId(id),
    onSettled: () => setDisconnectingId(null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ig-accounts'] }); setBanner({ tone: 'success', msg: 'Instagram account disconnected.' }); },
    onError: () => setBanner({ tone: 'error', msg: 'Could not disconnect. Please try again.' }),
  });
  const subscribeWebhooks = useMutation({
    mutationFn: (id: string) => instagramApi.subscribeWebhooks(id),
    onMutate: (id) => setSubscribingId(id),
    onSettled: () => setSubscribingId(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ig-accounts'] });
      setBanner({ tone: 'success', msg: loginOptions?.liveCommentsEnabled ? 'Instagram comment, message, and live-comment webhooks are set up.' : 'Instagram comment and message webhooks are set up.' });
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
  // Prefer the configured modern login for a new connection. For users who
  // already linked an account, keep that account's mode as the primary action
  // so reconnect/add-account flows do not silently switch OAuth integrations.
  const primaryLoginMode: LoginMode = active[0]?.loginMode === 'UNIFIED_LOGIN' && !loginOptions?.unifiedLoginEnabled
    ? 'INSTAGRAM_LOGIN'
    : active[0]?.loginMode ?? (loginOptions?.unifiedLoginEnabled ? 'UNIFIED_LOGIN' : 'INSTAGRAM_LOGIN');
  const alternateLoginMode: LoginMode = primaryLoginMode === 'UNIFIED_LOGIN' ? 'INSTAGRAM_LOGIN' : 'UNIFIED_LOGIN';
  const alternateLoginAvailable = alternateLoginMode === 'INSTAGRAM_LOGIN' || loginOptions?.unifiedLoginEnabled;
  const primaryLoginLabel = primaryLoginMode === 'UNIFIED_LOGIN' ? 'Connect Instagram with Meta' : 'Connect Instagram';
  const alternateLoginLabel = alternateLoginMode === 'UNIFIED_LOGIN'
    ? 'Connect with Meta Unified Login'
    : 'Use Instagram Login (legacy)';

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHead title="Instagram" sub={`Connect the professional accounts your automations run on. ${isPaidPlan ? `${planName}: up to ${cap} accounts.` : `Free: ${cap} account — upgrade for more.`}`} />

      {loginOptionsFailed && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--error-soft)', color: 'var(--error)' }}>
          <span>{loginOptionsError instanceof Error && loginOptionsError.message === LOGIN_OPTIONS_INCOMPLETE
            ? loginOptionsError.message
            : getApiErrorMessage(loginOptionsError, 'Could not load the available Meta login method. Retry before connecting so HeyLaunch uses the configured flow.')}</span>
          <Btn variant="ghost" onClick={() => void refetchLoginOptions()}>Retry</Btn>
        </div>
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
            <Btn variant="accent" disabled={connect.isPending || !loginOptions} onClick={() => connect.mutate(primaryLoginMode)}><Instagram style={{ width: 16, height: 16 }} /> {connect.isPending ? 'Opening…' : primaryLoginLabel}</Btn>
            {alternateLoginAvailable && <Btn variant="ghost" disabled={connect.isPending} onClick={() => connect.mutate(alternateLoginMode)}>{alternateLoginLabel}</Btn>}
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
                <Btn
                  variant="ghost"
                  disabled={disconnect.isPending}
                  onClick={() => {
                    if (window.confirm(`Disconnect @${a.username}? Active automations for this account will be paused.`)) {
                      disconnect.mutate(a.id);
                    }
                  }}
                >
                  <Unlink style={{ width: 15, height: 15 }} /> {disconnectingId === a.id ? 'Disconnecting…' : 'Disconnect'}
                </Btn>
              </div>
              <TokenExpiryNotice
                account={a}
                unifiedLoginEnabled={Boolean(loginOptions?.unifiedLoginEnabled)}
                isConnecting={connect.isPending}
                onReconnect={() => connect.mutate(a.loginMode)}
              />
              <div role="status" style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <span style={{ fontSize: 13, color: RL.muted }}>
                  {!a.webhookSubscribedAt
                    ? 'Account webhook subscription is not confirmed. Set it up, then verify live delivery with a test comment before relying on automations.'
                    : !a.lastWebhookAt
                      ? 'Account subscription succeeded, but HeyLaunch has not received a webhook event yet. Confirm Meta App Dashboard fields and permissions, then run a controlled comment or message test.'
                      : `Last webhook event received ${new Date(a.lastWebhookAt).toLocaleString()}. Live delivery still depends on Meta permissions and account eligibility.`}
                </span>
                {!a.webhookSubscribedAt && (
                  <Btn
                    variant="ghost"
                    disabled={subscribeWebhooks.isPending}
                    onClick={() => subscribeWebhooks.mutate(a.id)}
                  >
                    {subscribingId === a.id ? 'Setting up…' : 'Set up webhooks'}
                  </Btn>
                )}
              </div>
            </Card>
          ))}

          {/* Plan-aware add-account area */}
          <div style={{ fontSize: 12.5, color: RL.muted, marginTop: 2 }}>{active.length} of {cap} account{cap > 1 ? 's' : ''} used ({planName})</div>

          {canAddMore ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Btn variant="ghost" disabled={connect.isPending} onClick={() => connect.mutate(primaryLoginMode)}><Plus style={{ width: 16, height: 16 }} /> {connect.isPending ? 'Opening…' : 'Connect another account'}</Btn>
              {alternateLoginAvailable && <Btn variant="ghost" disabled={connect.isPending} onClick={() => connect.mutate(alternateLoginMode)}>{alternateLoginLabel}</Btn>}
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
