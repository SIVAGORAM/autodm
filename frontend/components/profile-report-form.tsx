'use client';

import { FormEvent, useState } from 'react';
import { Flag } from 'lucide-react';
import { api } from '../services/api';

const reasons = [
  ['IMPERSONATION', 'Impersonation'],
  ['SCAM', 'Scam or fraud'],
  ['INAPPROPRIATE', 'Inappropriate content'],
  ['SPAM', 'Spam'],
  ['COPYRIGHT', 'Copyright concern'],
  ['OTHER', 'Something else'],
] as const;

export function ProfileReportForm({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reasons)[number][0]>('IMPERSONATION');
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setFailed(false);
    try {
      await api.post(`/public/profiles/${encodeURIComponent(username)}/report`, {
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      setMessage('Thank you. Your report has been sent for review.');
      setDetails('');
      setOpen(false);
    } catch {
      setFailed(true);
      setMessage('We couldn’t send your report. Please try again later.');
    } finally {
      setPending(false);
    }
  }

  return <div className="hl-profile-report">
    <button type="button" className="hl-profile-report-toggle" aria-expanded={open} onClick={() => { setOpen((value) => !value); setMessage(''); }}>
      <Flag size={13} aria-hidden /> Report this profile
    </button>
    {open && <form className="hl-profile-report-form" onSubmit={submit}>
      <label htmlFor="hl-profile-report-reason">Why are you reporting this profile?</label>
      <select id="hl-profile-report-reason" value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>
        {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label htmlFor="hl-profile-report-details">Additional details <span>(optional)</span></label>
      <textarea id="hl-profile-report-details" value={details} maxLength={1000} onChange={(event) => setDetails(event.target.value)} rows={3}
        placeholder="Share relevant context. Don’t include passwords or private account details." />
      <button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send report'}</button>
    </form>}
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    <style>{`
      .hl-profile-report{display:grid;justify-items:center;gap:9px;margin:14px auto 0;color:var(--profile-muted);font-size:11px}
      .hl-profile-report-toggle{display:inline-flex;align-items:center;gap:5px;border:0;padding:5px;background:transparent;color:inherit;font:inherit;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
      .hl-profile-report-toggle:focus-visible,.hl-profile-report-form :focus-visible{outline:3px solid #93c83d;outline-offset:2px}
      .hl-profile-report-form{width:min(100%,420px);display:grid;gap:8px;text-align:left;padding:14px;border:1px solid var(--profile-border);border-radius:14px;background:var(--profile-card);color:var(--profile-text)}
      .hl-profile-report-form label{font-size:12px;font-weight:650}.hl-profile-report-form label span{font-weight:400;color:var(--profile-muted)}
      .hl-profile-report-form select,.hl-profile-report-form textarea{width:100%;min-height:40px;box-sizing:border-box;border:1px solid var(--profile-border);border-radius:8px;padding:9px 10px;background:var(--profile-bg);color:var(--profile-text);font:inherit;font-size:12px}
      .hl-profile-report-form textarea{resize:vertical;min-height:72px;line-height:1.5}
      .hl-profile-report-form button{justify-self:end;min-height:40px;padding:0 14px;border:0;border-radius:9px;background:#191c19;color:#fff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
      .hl-profile-report-form button:disabled{opacity:.6;cursor:wait}.hl-profile-report p{margin:0;text-align:center;line-height:1.5}
    `}</style>
  </div>;
}
