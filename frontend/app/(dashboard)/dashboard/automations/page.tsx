'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { automationApi } from '../../../../services/api';
import { RL, Card, Pill, Btn, Empty, Skel, PageHead } from '../../../../components/rl-kit';
import { Plus, Send, AlertCircle, ArrowRight } from 'lucide-react';

type Automation = {
  id: string; name: string; triggerType: string; status: 'DRAFT' | 'LIVE' | 'PAUSED';
  keywords: string[]; _count?: { runs: number }; health?: { level: string; label: string };
};
const triggerLabels: Record<string, string> = {
  POST_COMMENT: 'Post comment', NEXT_POST: 'Next post (legacy; unsupported)', ANY_POST: 'Any post',
  STORY_REPLY: 'Story reply', STORY_MENTION: 'Story mention', LIVE_COMMENT: 'Live comment', DM: 'Incoming DM',
};
const healthTone = (l?: string) => l === 'healthy' ? 'green' : l === 'needs_reconnect' ? 'coral' : l === 'at_risk' ? 'amber' : 'muted';
const statusTone = (s: string) => s === 'LIVE' ? 'green' : s === 'PAUSED' ? 'amber' : 'muted';

export default function AutomationsPage() {
  const qc = useQueryClient();
  const [toggleError, setToggleError] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['automations'], queryFn: async () => (await automationApi.list()).data.data as Automation[],
    refetchInterval: 15_000, refetchIntervalInBackground: false,
  });
  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'LIVE' | 'PAUSED' }) => automationApi.setStatus(id, status),
    onMutate: async ({ id, status }) => {
      setToggleError('');
      await qc.cancelQueries({ queryKey: ['automations'] });
      const previous = qc.getQueryData<Automation[]>(['automations']);
      if (previous) {
        qc.setQueryData<Automation[]>(['automations'], previous.map((a) => (a.id === id ? { ...a, status } : a)));
      }
      return { previous };
    },
    onError: (error: any, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['automations'], context.previous);
      }
      const message = error?.response?.data?.message;
      setToggleError(typeof message === 'string' ? message : 'Could not update the automation. Please try again.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  return (
    <div>
      <PageHead title="Automations" sub="Reply to comments, story replies and DMs automatically — every send tracked and logged."
        action={<Link href="/dashboard/automations/new" style={{ textDecoration: 'none' }}><Btn variant="accent"><Plus style={{ width: 16, height: 16 }} /> New automation</Btn></Link>} />

      {toggleError && <p role="alert" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 9, border: `1px solid ${RL.coral}55`, background: `${RL.coral}12`, color: RL.coral, fontSize: 13 }}>{toggleError}</p>}

      {isLoading && <div style={{ display: 'grid', gap: 10 }}>{[0, 1, 2].map((i) => <Skel key={i} h={78} />)}</div>}

      {isError && (
        <Empty icon={<AlertCircle style={{ width: 24, height: 24 }} />} title="Couldn’t load your automations"
          sub="Something went wrong talking to the server." action={<Btn variant="ghost" onClick={() => refetch()}>Try again</Btn>} />
      )}

      {data && data.length === 0 && (
        <Empty icon={<Send style={{ width: 24, height: 24 }} />} title="No automations yet"
          sub="Create a rule to send a prepared DM to matching comments, then review delivery outcomes in your logs."
          action={<Link href="/dashboard/automations/new" style={{ textDecoration: 'none' }}><Btn variant="accent"><Plus style={{ width: 16, height: 16 }} /> Create your first automation</Btn></Link>} />
      )}

      {data && data.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {data.map((a) => (
            <Card key={a.id} pad={16}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Link href={`/dashboard/automations/${a.id}`} style={{ minWidth: 0, flex: 1, textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 650, color: RL.ink }}>{a.name}</span>
                    <Pill tone={statusTone(a.status)}>{a.status.toLowerCase()}</Pill>
                    {a.health && <Pill tone={healthTone(a.health.level)} dot>{a.health.label}</Pill>}
                  </div>
                  <div style={{ fontSize: 13, color: RL.muted, marginTop: 4 }}>
                    {triggerLabels[a.triggerType] ?? a.triggerType}{a.keywords.length > 0 && ` · ${a.keywords.join(', ')}`} · {a._count?.runs ?? 0} runs
                  </div>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a.status !== 'DRAFT' ? (
                    <Btn variant="ghost" style={{ padding: '9px 14px' }} disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: a.id, status: a.status === 'LIVE' ? 'PAUSED' : 'LIVE' })}>
                      {a.status === 'LIVE' ? 'Pause' : 'Resume'}
                    </Btn>
                  ) : (
                    <Btn variant="accent" style={{ padding: '7px 14px', fontSize: 13 }} disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: a.id, status: 'LIVE' })}>
                      Go Live
                    </Btn>
                  )}
                  <Link href={`/dashboard/automations/${a.id}`} style={{ padding: 8, color: RL.faint }}><ArrowRight style={{ width: 18, height: 18 }} /></Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
