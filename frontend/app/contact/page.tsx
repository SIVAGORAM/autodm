'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, CheckCircle2, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { Card, Btn, RLStyles } from '../../components/rl-kit';
import { contactApi } from '../../services/api';

const fieldStyle = {
  width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)',
  font: 'inherit', outlineColor: 'var(--accent)',
} as const;

export default function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    try {
      await contactApi.createEnquiry({
        name: String(data.get('name') ?? ''),
        email: String(data.get('email') ?? ''),
        subject: String(data.get('subject') ?? ''),
        message: String(data.get('message') ?? ''),
        website: String(data.get('website') ?? ''),
      });
      form.reset();
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not submit your message. Please try again shortly.');
    } finally {
      setSubmitting(false);
    }
  }

  return <main style={{ minHeight: '100vh', padding: '28px 18px 64px', background: 'var(--bg)', color: 'var(--text)' }}>
    <RLStyles />
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}>
        <ArrowLeft size={16} aria-hidden /> Back to HeyLaunch
      </Link>
      <header style={{ margin: '44px 0 22px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 650 }}>
          <MessageSquareText size={16} aria-hidden /> TALK WITH OUR TEAM
        </span>
        <h1 style={{ margin: '12px 0 8px', fontSize: 'clamp(30px, 6vw, 42px)', letterSpacing: '-1.4px' }}>How can we help?</h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.65 }}>Send a question about HeyLaunch, partnerships, or getting started. We’ll follow up by email.</p>
      </header>

      <Card pad={24}>
        {submitted ? <div role="status" style={{ textAlign: 'center', padding: '26px 8px' }}>
          <CheckCircle2 size={34} color="var(--success)" aria-hidden />
          <h2 style={{ margin: '12px 0 6px', fontSize: 20 }}>Message received</h2>
          <p style={{ margin: '0 auto 18px', maxWidth: 420, color: 'var(--text-muted)', lineHeight: 1.6 }}>Your enquiry was saved. If an email address was provided, our team can reply to it from the HeyLaunch inbox.</p>
          <Btn variant="ghost" onClick={() => setSubmitted(false)}>Send another message</Btn>
        </div> : <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          <label style={{ display: 'grid', gap: 7, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            Your name
            <input name="name" required minLength={2} maxLength={100} autoComplete="name" style={fieldStyle} />
          </label>
          <label style={{ display: 'grid', gap: 7, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            Email address
            <input name="email" type="email" required maxLength={254} autoComplete="email" style={fieldStyle} />
          </label>
          <label style={{ display: 'grid', gap: 7, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            Subject
            <input name="subject" required minLength={3} maxLength={120} style={fieldStyle} />
          </label>
          <label style={{ display: 'grid', gap: 7, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            Message
            <textarea name="message" required minLength={10} maxLength={5000} rows={6} style={{ ...fieldStyle, resize: 'vertical' }} />
          </label>
          <label aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            Leave this field empty
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.5 }}>Please don’t include passwords, access tokens, or sensitive account data. By sending this form, you agree that we may use these details to respond as described in our <Link href="/privacy" style={{ color: 'var(--text)' }}>Privacy Notice</Link>.</p>
          <Btn type="submit" variant="accent" loading={submitting} disabled={submitting}>Send message</Btn>
        </form>}
      </Card>
    </div>
  </main>;
}
