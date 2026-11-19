'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../../store/authStore';
import { RL, Card, Btn, PageHead } from '../../../../components/rl-kit';
import { MessageSquare, Heart } from 'lucide-react';

export default function FeedbackPage() {
  const { user } = useAuthStore();
  const [rating, setRating] = useState<number>(0);
  const [text, setText] = useState('');
  function send() {
    if (!text.trim()) return toast.error('Add a note so we know what to improve');
    const sub = encodeURIComponent('Relayo feedback' + (rating ? ' (' + rating + '/5)' : ''));
    const body = encodeURIComponent(text + '\n\n— ' + (user?.name ?? '') + ' (' + (user?.email ?? '') + ')');
    window.location.href = 'mailto:feedback@relayo.app?subject=' + sub + '&body=' + body;
    toast.success('Thank you! Opening your email to send.');
  }
  return (
    <div style={{ maxWidth: 560 }}>
      <PageHead title="Share feedback" sub="What’s working, what’s missing? You shape where Relayo goes next." />
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <MessageSquare style={{ width: 18, height: 18, color: RL.teal }} /><span style={{ fontSize: 15, fontWeight: 650, color: RL.ink }}>How’s your experience?</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} style={{ width: 44, height: 44, borderRadius: 11, cursor: 'pointer', fontSize: 16, fontWeight: 700,
              border: '1px solid ' + (rating >= n ? RL.teal : RL.line), background: rating >= n ? RL.tealSoft : '#fff', color: rating >= n ? RL.teal : RL.muted }}>{n}</button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell us more…"
          style={{ width: '100%', minHeight: 130, borderRadius: 11, border: '1px solid ' + RL.line, padding: '12px 14px', fontSize: 14.5, color: RL.ink, outline: 'none', resize: 'vertical', marginBottom: 16 }} />
        <Btn onClick={send} variant="accent"><Heart style={{ width: 16, height: 16 }} /> Send feedback</Btn>
      </Card>
    </div>
  );
}
