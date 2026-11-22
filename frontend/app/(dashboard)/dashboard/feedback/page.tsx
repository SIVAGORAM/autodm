'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supportApi } from '../../../../services/api';
import { RL, Card, Btn, PageHead, Pill, Skel } from '../../../../components/rl-kit';
import { MessageSquare, Heart } from 'lucide-react';

type SupportRequest = {
  id: string;
  type: 'SUPPORT' | 'FEEDBACK';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  subject: string;
  messages: { id: string; senderType: 'CUSTOMER' | 'ADMIN'; body: string; createdAt: string }[];
  rating: number | null;
  createdAt: string;
};

export default function FeedbackPage() {
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: ['support', 'mine'],
    queryFn: async () => (await supportApi.mine()).data.data as SupportRequest[],
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const submit = useMutation({
    mutationFn: () => supportApi.create({
      type: 'FEEDBACK',
      subject: 'Product feedback',
      message,
      ...(rating ? { rating } : {}),
    }),
    onSuccess: async () => {
      setMessage('');
      setRating(0);
      toast.success('Thanks — your feedback is saved for the team.');
      await queryClient.invalidateQueries({ queryKey: ['support', 'mine'] });
    },
    onError: () => toast.error('Could not save feedback. Please try again.'),
  });

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHead title="Share feedback" sub="Tell us what is working and what should improve. Your feedback is saved to your account so you can track it here." />
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <MessageSquare style={{ width: 18, height: 18, color: RL.teal }} aria-hidden />
          <span style={{ fontSize: 15, fontWeight: 650, color: RL.ink }}>How is your experience?</span>
        </div>
        <div role="group" aria-label="Optional rating" style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" aria-label={`Rate ${value} out of 5`} aria-pressed={rating === value}
              onClick={() => setRating(value)} style={{ width: 44, height: 44, borderRadius: 11, cursor: 'pointer', fontSize: 16, fontWeight: 700,
                border: '1px solid ' + (rating >= value ? RL.teal : RL.line), background: rating >= value ? RL.tealSoft : '#fff', color: rating >= value ? RL.teal : RL.muted }}>{value}</button>
          ))}
        </div>
        <label htmlFor="feedback-message" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: RL.ink, marginBottom: 7 }}>Your feedback</label>
        <textarea id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value.slice(0, 5_000))}
          maxLength={5_000} required minLength={10} placeholder="Tell us what you think…"
          style={{ width: '100%', minHeight: 130, borderRadius: 11, border: '1px solid ' + RL.line, padding: '12px 14px', fontSize: 14.5, color: RL.ink, outline: 'none', resize: 'vertical', marginBottom: 8 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: RL.muted, fontSize: 12.5 }} aria-live="polite">{message.length}/5,000 characters</span>
          <Btn variant="accent" loading={submit.isPending} disabled={message.trim().length < 10} onClick={() => submit.mutate()}>
            <Heart style={{ width: 16, height: 16 }} aria-hidden /> Send feedback
          </Btn>
        </div>
      </Card>

      <h2 style={{ fontSize: 16, margin: '26px 0 12px', color: RL.ink }}>Your feedback history</h2>
      {requests.isError ? (
        <Card><p role="alert" style={{ margin: 0, color: RL.coral }}>Could not load your feedback history.</p></Card>
      ) : requests.isLoading ? (
        <div style={{ display: 'grid', gap: 10 }}><Skel h={82} /><Skel h={82} /></div>
      ) : requests.data?.filter((request) => request.type === 'FEEDBACK').length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {requests.data.filter((request) => request.type === 'FEEDBACK').map((request) => (
            <Card key={request.id} pad={16}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13.5, color: RL.ink }}>{new Date(request.createdAt).toLocaleDateString()}</strong>
                <Pill tone={request.status === 'RESOLVED' ? 'green' : request.status === 'IN_PROGRESS' ? 'amber' : 'muted'} dot>
                  {request.status === 'IN_PROGRESS' ? 'In review' : request.status.toLowerCase()}
                </Pill>
              </div>
              <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
                {request.messages.map((item) => (
                  <div key={item.id} style={{ padding: '10px 12px', borderRadius: 10, background: item.senderType === 'ADMIN' ? RL.tealSoft : 'var(--surface)', border: '1px solid ' + RL.line }}>
                    <div style={{ color: RL.muted, fontSize: 11.5, marginBottom: 5 }}>{item.senderType === 'ADMIN' ? 'HeyLaunch team' : 'You'} · {new Date(item.createdAt).toLocaleString()}</div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: RL.ink, fontSize: 13.5, lineHeight: 1.55 }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><p style={{ margin: 0, color: RL.muted, fontSize: 13.5 }}>You have not sent feedback yet.</p></Card>
      )}
    </div>
  );
}
