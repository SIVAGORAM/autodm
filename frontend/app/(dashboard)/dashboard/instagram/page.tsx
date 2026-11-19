'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instagramApi, paymentApi } from '../../../../services/api';
import { RL, Card, Pill, Btn, Empty, Skel, PageHead } from '../../../../components/rl-kit';
import { Instagram, Plus, AlertCircle, Unlink, CheckCircle2, X, Sparkles, Lock } from 'lucide-react';

type IgAccount = { id: string; username: string; igUserId: string; isActive: boolean; tokenExpiresAt?: string };

export default function InstagramPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (params.get('connected')) { setBanner({ tone: 'success', msg: 'Instagram account connected.' }); router.replace('/dashboard/instagram'); }
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
  });
  const sub = useQuery({
    queryKey: ['subscription'], queryFn: async () => (await paymentApi.getSubscription()).data.data as { plan: string; active: boolean },
  });

  const connect = useMutation({
    mutationFn: async () => (await instagramApi.getAuthUrl()).data.data.url as string,
    onSuccess: (url) => { window.location.href = url; },
    onError: () => setBanner({ tone: 'error', msg: 'Could not start the connect flow. Please try again.' }),
  });
  const disconnect = useMutation({
    mutationFn: (id: string) => instagramApi.disconnect(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ig-accounts'] }); setBanner({ tone: 'success', msg: 'Instagram account disconnected.' }); },
    onError: () => setBanner({ tone: 'error', msg: 'Could not disconnect. Please try again.' }),
  });

  const active = (data ?? []).filter((a) => a.isActive);
  const isPro = sub.data?.plan === 'pro';
  const cap = isPro ? 5 : 1;
  const canAddMore = active.length < cap;

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHead title="Instagram" sub={`Connect the professional accounts your automations run on. ${isPro ? 'Pro: up to 5 accounts.' : 'Free: 1 account — upgrade to Pro for up to 5.'}`} />

      {banner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, padding: '12px 16px', borderRadius: 12,
          background: banner.tone === 'success' ? RL.greenSoft : RL.coralSoft, color: banner.tone === 'success' ? RL.green : RL.coral, border: `1px solid ${banner.tone === 'success' ? '#CDEBDD' : RL.coralSoft}` }}>
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
          action={<Btn variant="accent" disabled={connect.isPending} onClick={() => connect.mutate()}><Instagram style={{ width: 16, height: 16 }} /> {connect.isPending ? 'Opening…' : 'Connect Instagram'}</Btn>} />
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
            </Card>
          ))}

          {/* Plan-aware add-account area */}
          <div style={{ fontSize: 12.5, color: RL.muted, marginTop: 2 }}>{active.length} of {cap} account{cap > 1 ? 's' : ''} used{isPro ? ' (Pro)' : ' (Free)'}</div>

          {canAddMore ? (
            <div><Btn variant="ghost" disabled={connect.isPending} onClick={() => connect.mutate()}><Plus style={{ width: 16, height: 16 }} /> {connect.isPending ? 'Opening…' : 'Connect another account'}</Btn></div>
          ) : !isPro ? (
            <Card pad={18} style={{ borderColor: RL.tealSoft, background: `linear-gradient(90deg, ${RL.tealSoft}66, #fff 60%)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: '#fff', border: `1px solid ${RL.tealSoft}`, color: RL.teal, display: 'grid', placeItems: 'center' }}><Lock style={{ width: 18, height: 18 }} /></div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 650, color: RL.ink }}>Want to run more than one account?</div>
                  <div style={{ fontSize: 13, color: RL.muted, marginTop: 2 }}>Free includes 1 account. Upgrade to Pro to connect up to 5.</div>
                </div>
              </div>
              <Link href="/dashboard/billing" style={{ textDecoration: 'none' }}><Btn variant="accent"><Sparkles style={{ width: 15, height: 15 }} /> Upgrade to Pro</Btn></Link>
            </Card>
          ) : (
            <div style={{ fontSize: 13, color: RL.muted }}>You’ve reached your Pro limit of 5 connected accounts.</div>
          )}
        </div>
      )}
    </div>
  );
}
