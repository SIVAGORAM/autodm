'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instagramApi } from '../../../../services/api';
import { RL, Card, Pill, Btn, Empty, Skel, PageHead } from '../../../../components/rl-kit';
import { Instagram, Plus, AlertCircle, Unlink, CheckCircle2, X } from 'lucide-react';

type IgAccount = { id: string; username: string; igUserId: string; isActive: boolean; tokenExpiresAt?: string };

export default function InstagramPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  // Read the one-time ?connected / ?error flag, show the banner, then strip it from the URL
  // so a refresh (or a later disconnect) never re-shows a stale "connected" message.
  useEffect(() => {
    if (params.get('connected')) {
      setBanner({ tone: 'success', msg: 'Instagram account connected.' });
      router.replace('/dashboard/instagram');
    }
    const err = params.get('error');
    if (err) {
      setBanner({ tone: 'error', msg: decodeURIComponent(err) });
      router.replace('/dashboard/instagram');
    }
  }, [params, router]);

  // Auto-dismiss any banner after 5s
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ig-accounts'],
    queryFn: async () => (await instagramApi.accounts()).data.data as IgAccount[],
  });

  const connect = useMutation({
    mutationFn: async () => (await instagramApi.getAuthUrl()).data.data.url as string,
    onSuccess: (url) => { window.location.href = url; },
    onError: () => setBanner({ tone: 'error', msg: 'Could not start the connect flow. Please try again.' }),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => instagramApi.disconnect(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ig-accounts'] });
      setBanner({ tone: 'success', msg: 'Instagram account disconnected.' });
    },
    onError: () => setBanner({ tone: 'error', msg: 'Could not disconnect. Please try again.' }),
  });

  const active = (data ?? []).filter((a) => a.isActive);

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHead title="Instagram" sub="Connect the professional accounts your automations run on. Free includes 1 account; Pro supports up to 5." />

      {banner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, padding: '12px 16px', borderRadius: 12,
          background: banner.tone === 'success' ? RL.greenSoft : RL.coralSoft, color: banner.tone === 'success' ? RL.green : RL.coral, border: `1px solid ${banner.tone === 'success' ? '#CDEBDD' : RL.coralSoft}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 600 }}>
            {banner.tone === 'success' ? <CheckCircle2 style={{ width: 17, height: 17 }} /> : <AlertCircle style={{ width: 17, height: 17 }} />}
            {banner.msg}
          </span>
          <button onClick={() => setBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.7, display: 'grid', placeItems: 'center' }}><X style={{ width: 15, height: 15 }} /></button>
        </div>
      )}

      {isLoading && <Skel h={96} />}

      {isError && (
        <Empty icon={<AlertCircle style={{ width: 24, height: 24 }} />} title="Couldn’t load your accounts" sub="Something went wrong talking to the server." />
      )}

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
                <Btn variant="ghost" disabled={disconnect.isPending} onClick={() => disconnect.mutate(a.id)}>
                  <Unlink style={{ width: 15, height: 15 }} /> Disconnect
                </Btn>
              </div>
            </Card>
          ))}
          <div>
            <Btn variant="ghost" disabled={connect.isPending} onClick={() => connect.mutate()}>
              <Plus style={{ width: 16, height: 16 }} /> {connect.isPending ? 'Opening…' : 'Connect another account'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
