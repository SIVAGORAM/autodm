'use client';

import Link from 'next/link';
import { RL, Card, Btn, PageHead } from '../../../../components/rl-kit';
import { Instagram, Zap, FileText, ShieldCheck, Mail, ArrowRight } from 'lucide-react';

const faqs = [
  { q: 'How do I connect my Instagram account?', a: 'Go to the Instagram page and click Connect. You’ll sign in through Meta’s official login — no password sharing. Only professional (Business or Creator) accounts can send automated DMs.' },
  { q: 'Why isn’t my automation sending DMs?', a: 'Check its health badge. “Needs reconnect” means your Instagram token expired — reconnect on the Instagram page. Also make sure the automation is Live, not Draft or Paused, and that your keyword matches the comments.' },
  { q: 'What counts as a “run”?', a: 'Every time a comment matches your automation, we log a run — whether the DM sent, was skipped, or failed. You can see all of them in DM Logs.' },
  { q: 'Is this against Instagram’s rules?', a: 'No. Relayo uses Instagram’s official Messaging API, which is built for exactly this. We never automate your login or scrape the app.' },
  { q: 'How do I upgrade to Pro?', a: 'Open Billing and choose Pro. Pro unlocks unlimited keywords, story/live/DM triggers, follow-ups, and break alerts.' },
];
const quick = [
  { icon: <Instagram style={{ width: 18, height: 18 }} />, t: 'Connect Instagram', h: '/dashboard/instagram' },
  { icon: <Zap style={{ width: 18, height: 18 }} />, t: 'Build an automation', h: '/dashboard/automations/new' },
  { icon: <FileText style={{ width: 18, height: 18 }} />, t: 'Check your DM logs', h: '/dashboard/logs' },
];

export default function HelpPage() {
  return (
    <div style={{ maxWidth: 760 }}>
      <PageHead title="Help Center" sub="Answers to the common questions. Still stuck? We reply fast." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {quick.map((q) => (
          <Link key={q.t} href={q.h} style={{ textDecoration: 'none' }}>
            <Card pad={16} hover>
              <div style={{ color: RL.teal, marginBottom: 10 }}>{q.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 650, color: RL.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{q.t} <ArrowRight style={{ width: 15, height: 15, color: RL.faint }} /></div>
            </Card>
          </Link>
        ))}
      </div>
      <Card pad={0}>
        {faqs.map((f, i) => (
          <details key={i} style={{ borderBottom: i < faqs.length - 1 ? '1px solid ' + RL.lineSoft : 'none' }}>
            <summary style={{ listStyle: 'none', cursor: 'pointer', padding: '18px 22px', fontSize: 15, fontWeight: 600, color: RL.ink }}>{f.q}</summary>
            <p style={{ padding: '0 22px 18px', margin: 0, color: RL.muted, fontSize: 14, lineHeight: 1.65 }}>{f.a}</p>
          </details>
        ))}
      </Card>
      <Card style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: RL.tealSoft, color: RL.teal, display: 'grid', placeItems: 'center' }}><Mail style={{ width: 19, height: 19 }} /></div>
          <div><div style={{ fontSize: 14.5, fontWeight: 650, color: RL.ink }}>Still need help?</div><div style={{ fontSize: 13, color: RL.muted }}>Email us and we’ll get back within a day.</div></div>
        </div>
        <Link href="/dashboard/help/email-us" style={{ textDecoration: 'none' }}><Btn>Contact support</Btn></Link>
      </Card>
    </div>
  );
}
