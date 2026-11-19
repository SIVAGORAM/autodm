'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instagramApi } from '../../../../services/api';
import { Button, Card, Badge, Skeleton } from '../../../../components/ui/primitives';
import { Instagram, Plus, AlertCircle, Unlink } from 'lucide-react';

type IgAccount = { id: string; username: string; igUserId: string; isActive: boolean; tokenExpiresAt?: string };

export default function InstagramPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (params.get('connected')) setBanner({ tone: 'success', msg: 'Instagram account connected.' });
    const err = params.get('error');
    if (err) setBanner({ tone: 'error', msg: decodeURIComponent(err) });
  }, [params]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ig-accounts'],
    queryFn: async () => (await instagramApi.accounts()).data.data as IgAccount[],
  });

  const connect = useMutation({
    mutationFn: async () => (await instagramApi.getAuthUrl()).data.data.url as string,
    onSuccess: (url) => { window.location.href = url; },
    onError: () => setBanner({ tone: 'error', msg: 'Could not start the connect flow.' }),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => instagramApi.disconnect(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ig-accounts'] }),
  });

  const active = (data ?? []).filter((a) => a.isActive);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Instagram</h1>
        <p className="text-sm text-muted-foreground">Connect the professional accounts your automations run on.</p>
      </header>

      {banner && (
        <div className={`rounded-md border px-3 py-2 text-sm ${banner.tone === 'success' ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
          {banner.msg}
        </div>
      )}

      {isLoading && <Skeleton className="h-24 w-full" />}

      {isError && (
        <Card className="p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
          <p className="text-sm text-foreground">Couldn&apos;t load your accounts.</p>
        </Card>
      )}

      {data && active.length === 0 && (
        <Card className="p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Instagram className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-lg font-medium text-foreground">No account connected</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Connect an Instagram professional account to start sending auto-DMs.
          </p>
          <Button className="mt-5" loading={connect.isPending} onClick={() => connect.mutate()}>
            <Instagram className="h-4 w-4" /> Connect Instagram
          </Button>
        </Card>
      )}

      {data && active.length > 0 && (
        <div className="space-y-3">
          {active.map((a) => (
            <Card key={a.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Instagram className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">@{a.username}</p>
                  <Badge tone="success">connected</Badge>
                </div>
              </div>
              <Button variant="secondary" className="h-9" loading={disconnect.isPending} onClick={() => disconnect.mutate(a.id)}>
                <Unlink className="h-4 w-4" /> Disconnect
              </Button>
            </Card>
          ))}
          <Button variant="ghost" loading={connect.isPending} onClick={() => connect.mutate()}>
            <Plus className="h-4 w-4" /> Connect another account
          </Button>
        </div>
      )}
    </div>
  );
}
