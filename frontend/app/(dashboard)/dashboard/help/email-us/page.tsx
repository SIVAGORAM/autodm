'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supportApi } from '../../../../../services/api';
import { RL, Card, Btn, PageHead, Pill, Skel } from '../../../../../components/rl-kit';
import { LifeBuoy } from 'lucide-react';

type SupportRequest = {
  id: string;
  type: 'SUPPORT' | 'FEEDBACK';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  subject: string;
  messages: { id: string; senderType: 'CUSTOMER' | 'ADMIN'; body: string; createdAt: string }[];
  createdAt: string;
};

const field: React.CSSProperties = {
  width: '100%', borderRadius: 11, border: '1px solid ' + RL.line, padding: '12px 14px',
  fontSize: 14.5, color: RL.ink, background: 'var(--surface)', outline: 'none',
};
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: RL.ink, display: 'block', marginBottom: 7 };

export default function ContactSupportPage() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: ['support', 'mine'],
    queryFn: async () => (await supportApi.mine()).data.data as SupportRequest[],
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const submit = useMutation({
    mutationFn: () => supportApi.create({ type: 'SUPPORT', subject, message }),
    onSuccess: async () => {
      setSubject('');
      setMessage('');
      toast.success('Your support request has been saved.');
      await queryClient.invalidateQueries({ queryKey: ['support', 'mine'] });
    },
    onError: () => toast.error('Could not save your request. Please try again.'),
  });
  const reply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => supportApi.reply(id, body),
    onSuccess: async (_result, variables) => {
      setReplies((current) => ({ ...current, [variables.id]: '' }));
      toast.success('Your reply has been sent.');
      await queryClient.invalidateQueries({ queryKey: ['support', 'mine'] });
    },
    onError: () => toast.error('Could not send your reply. Please try again.'),
  });

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHead title="Contact support" sub="Send a request from your account and check its status here. Please do not include passwords, payment details, or access tokens." />
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <LifeBuoy style={{ width: 18, height: 18, color: RL.teal }} aria-hidden />
          <strong style={{ fontSize: 15, color: RL.ink }}>New support request</strong>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label htmlFor="support-subject" style={label}>Subject</label>
            <input id="support-subject" style={field} value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value.slice(0, 120))} placeholder="What do you need help with?" />
          </div>
          <div>
            <label htmlFor="support-message" style={label}>Message</label>
            <textarea id="support-message" style={{ ...field, minHeight: 150, resize: 'vertical' }} value={message} maxLength={5_000}
              onChange={(event) => setMessage(event.target.value.slice(0, 5_000))} placeholder="Describe what happened and what you expected…" />
            <div style={{ textAlign: 'right', color: RL.muted, fontSize: 12, marginTop: 5 }} aria-live="polite">{message.length}/5,000</div>
          </div>
          <div>
            <Btn loading={submit.isPending} disabled={subject.trim().length < 3 || message.trim().length < 10} onClick={() => submit.mutate()}>
              Submit request
            </Btn>
          </div>
          <p style={{ fontSize: 12.5, color: RL.muted, margin: 0 }}>Requests are visible to authorized HeyLaunch administrators. Your latest 50 requests are available in this dashboard.</p>
        </div>
      </Card>

      <h2 style={{ fontSize: 16, margin: '26px 0 12px', color: RL.ink }}>Your requests</h2>
      {requests.isError ? (
        <Card><p role="alert" style={{ margin: 0, color: RL.coral }}>Could not load support request history.</p></Card>
      ) : requests.isLoading ? (
        <div style={{ display: 'grid', gap: 10 }}><Skel h={96} /><Skel h={96} /></div>
      ) : requests.data?.filter((request) => request.type === 'SUPPORT').length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {requests.data.filter((request) => request.type === 'SUPPORT').map((request) => (
            <Card key={request.id} pad={16}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ color: RL.ink, fontSize: 14 }}>{request.subject}</strong>
                  <div style={{ color: RL.muted, fontSize: 12.5, marginTop: 4 }}>{new Date(request.createdAt).toLocaleString()}</div>
                </div>
                <Pill tone={request.status === 'RESOLVED' ? 'green' : request.status === 'IN_PROGRESS' ? 'amber' : 'muted'} dot>
                  {request.status === 'IN_PROGRESS' ? 'In review' : request.status.toLowerCase()}
                </Pill>
              </div>
              <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
                {request.messages.map((item) => (
                  <div key={item.id} style={{ padding: '10px 12px', borderRadius: 10, background: item.senderType === 'ADMIN' ? 'var(--accent-soft)' : 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ color: RL.muted, fontSize: 11.5, marginBottom: 5 }}>{item.senderType === 'ADMIN' ? 'HeyLaunch team' : 'You'} · {new Date(item.createdAt).toLocaleString()}</div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: RL.ink, fontSize: 13.5, lineHeight: 1.55 }}>{item.body}</p>
                  </div>
                ))}
              </div>
              {request.status !== 'RESOLVED' && (
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  <label htmlFor={`reply-${request.id}`} style={label}>Reply</label>
                  <textarea id={`reply-${request.id}`} style={{ ...field, minHeight: 90, resize: 'vertical' }} value={replies[request.id] ?? ''} maxLength={5_000}
                    onChange={(event) => setReplies((current) => ({ ...current, [request.id]: event.target.value.slice(0, 5_000) }))} placeholder="Add details or answer a question…" />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Btn loading={reply.isPending} disabled={(replies[request.id] ?? '').trim().length < 1} onClick={() => reply.mutate({ id: request.id, body: replies[request.id] ?? '' })}>Send reply</Btn>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card><p style={{ margin: 0, color: RL.muted, fontSize: 13.5 }}>You have not submitted a support request yet.</p></Card>
      )}
    </div>
  );
}
