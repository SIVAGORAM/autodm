'use client';

import { useState } from 'react';
import { useAuthStore } from '../../../../../store/authStore';
import { RL, Card, Btn, PageHead } from '../../../../../components/rl-kit';
import { Mail } from 'lucide-react';

const field: React.CSSProperties = { width: '100%', borderRadius: 11, border: '1px solid ' + RL.line, padding: '12px 14px', fontSize: 14.5, color: RL.ink, background: '#fff', outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: RL.ink, display: 'block', marginBottom: 7 };

export default function EmailUs() {
  const { user } = useAuthStore();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  function send() {
    const to = 'support@relayo.app';
    const sub = encodeURIComponent(subject || 'Relayo support request');
    const text = encodeURIComponent(body + '\n\n— ' + (user?.name ?? '') + ' (' + (user?.email ?? '') + ')');
    window.location.href = 'mailto:' + to + '?subject=' + sub + '&body=' + text;
  }
  return (
    <div style={{ maxWidth: 620 }}>
      <PageHead title="Contact support" sub="Tell us what’s going on. We read every message." />
      <Card>
        <div style={{ display: 'grid', gap: 16 }}>
          <div><label style={lbl}>Subject</label><input style={field} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What’s this about?" /></div>
          <div><label style={lbl}>Message</label><textarea style={{ ...field, minHeight: 150, resize: 'vertical' }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe the issue or question…" /></div>
          <div><Btn onClick={send}><Mail style={{ width: 16, height: 16 }} /> Send email</Btn></div>
          <p style={{ fontSize: 12.5, color: RL.muted, margin: 0 }}>This opens your email app addressed to our support team, with your account details attached.</p>
        </div>
      </Card>
    </div>
  );
}
