'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquareText, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../../../../../../services/api';
import { Btn, Card, PageHead, Pill, Skel } from '../../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../../store/authStore';

type EnquiryStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED' | 'SPAM';
type EnquiryPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type Enquiry = {
  id: string; name: string; email: string; subject: string; status: EnquiryStatus; priority: EnquiryPriority;
  assignedAdminId: string | null; assignedAdmin: { id: string; name: string; email: string } | null;
  createdAt: string; updatedAt: string;
  messages: { id: string; kind: 'SUBMISSION' | 'ADMIN_REPLY' | 'INTERNAL_NOTE'; body: string; createdAt: string;
    emailDeliveryStatus: 'NOT_APPLICABLE' | 'QUEUED' | 'SENT' | 'FAILED' | 'CANCELLED'; authorAdmin: { id: string; name: string } | null }[];
};

const fieldStyle = { minHeight: 40, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit' } as const;
const statusText: Record<EnquiryStatus, string> = { NEW: 'New', IN_PROGRESS: 'In progress', WAITING_FOR_CUSTOMER: 'Waiting for customer', RESOLVED: 'Resolved', CLOSED: 'Closed', SPAM: 'Spam' };
const emailText: Record<string, string> = { QUEUED: 'Queued', SENT: 'Accepted by mail provider', FAILED: 'Failed', CANCELLED: 'Cancelled', NOT_APPLICABLE: '' };

export default function ContactEnquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<EnquiryStatus>('NEW');
  const [priority, setPriority] = useState<EnquiryPriority>('NORMAL');
  const [reason, setReason] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'contact-enquiry', id], enabled: isAdmin && !!id,
    queryFn: async () => (await adminApi.contactEnquiry(id)).data.data as Enquiry,
    refetchInterval: 15_000,
  });
  useEffect(() => {
    if (query.data) {
      setStatus(query.data.status);
      setPriority(query.data.priority);
    }
  }, [query.data?.id, query.data?.status, query.data?.priority]);
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin', 'contact-enquiry', id] }),
    queryClient.invalidateQueries({ queryKey: ['admin', 'contact-enquiries'] }),
  ]);
  const updateStatus = useMutation({
    mutationFn: () => adminApi.updateContactEnquiryStatus(id, status, reason.trim()),
    onSuccess: async () => { setReason(''); toast.success('Enquiry status updated.'); await refresh(); },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not update status.'),
  });
  const updatePriority = useMutation({
    mutationFn: () => adminApi.updateContactEnquiryPriority(id, priority, reason.trim()),
    onSuccess: async () => { setReason(''); toast.success('Priority updated.'); await refresh(); },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not update priority.'),
  });
  const assign = useMutation({
    mutationFn: (assignedAdminId: string | null) => adminApi.assignContactEnquiry(id, assignedAdminId),
    onSuccess: async (_result, adminId) => { toast.success(adminId ? 'Enquiry assigned to you.' : 'Enquiry unassigned.'); await refresh(); },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not change assignment.'),
  });
  const reply = useMutation({
    mutationFn: () => adminApi.replyToContactEnquiry(id, replyBody.trim()),
    onSuccess: async () => { setReplyBody(''); toast.success('Reply saved and email queued. Check delivery status below.'); await refresh(); },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not queue reply.'),
  });
  const note = useMutation({
    mutationFn: () => adminApi.addContactEnquiryNote(id, noteBody.trim()),
    onSuccess: async () => { setNoteBody(''); toast.success('Internal note saved.'); await refresh(); },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not save note.'),
  });

  function submitMessage(event: FormEvent<HTMLFormElement>, kind: 'reply' | 'note') {
    event.preventDefault();
    if (kind === 'reply') reply.mutate();
    else note.mutate();
  }

  if (!isAdmin) return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
    <ShieldAlert size={26} color="var(--warning)" aria-hidden /><h1 style={{ fontSize: 18 }}>Administrator access required</h1>
  </Card>;

  return <div>
    <Link href="/dashboard/admin/enquiries" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 14, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>
      <ArrowLeft size={15} aria-hidden /> Contact enquiries
    </Link>
    {query.isError ? <Card><p role="alert" style={{ color: 'var(--error)' }}>Could not load this enquiry.</p></Card>
      : query.isLoading || !query.data ? <Skel h={360} /> : <>
        {(() => {
          const enquiry = query.data;
          return <>
            <PageHead title={enquiry.subject} sub={`${enquiry.name} · ${enquiry.email} · received ${new Date(enquiry.createdAt).toLocaleString()}`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(260px,340px)', gap: 14, alignItems: 'start' }} className="contact-enquiry-grid">
              <div style={{ display: 'grid', gap: 12 }}>
                <Card pad={18}>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 14px', fontSize: 15, color: 'var(--text)' }}><MessageSquareText size={16} aria-hidden /> Conversation</h2>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {enquiry.messages.map((message) => <article key={message.id} style={{ padding: 13, borderRadius: 10,
                      background: message.kind === 'INTERNAL_NOTE' ? 'var(--warning-soft)' : 'var(--surface-soft)',
                      border: `1px solid ${message.kind === 'INTERNAL_NOTE' ? 'var(--warning-soft)' : 'var(--border-soft)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--text)', fontSize: 12.5 }}>
                          {message.kind === 'SUBMISSION' ? 'Visitor' : message.kind === 'INTERNAL_NOTE' ? `Internal note · ${message.authorAdmin?.name || 'Admin'}` : message.authorAdmin?.name || 'HeyLaunch team'}
                        </strong>
                        <span style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>{new Date(message.createdAt).toLocaleString()}</span>
                      </div>
                      <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.body}</div>
                      {message.kind === 'ADMIN_REPLY' && <div style={{ marginTop: 8, fontSize: 11.5, color: message.emailDeliveryStatus === 'FAILED' ? 'var(--error)' : 'var(--text-faint)' }}>
                        Email: {emailText[message.emailDeliveryStatus] || 'Not applicable'}{message.emailDeliveryStatus === 'SENT' ? ' (SMTP acceptance; inbox delivery is not confirmed)' : ''}
                      </div>}
                    </article>)}
                  </div>
                </Card>
                <Card pad={18}>
                  <form onSubmit={(event) => submitMessage(event, 'reply')} style={{ display: 'grid', gap: 10 }}>
                    <label htmlFor="contact-reply" style={{ color: 'var(--text)', fontWeight: 650, fontSize: 13.5 }}>Reply by email</label>
                    <textarea id="contact-reply" value={replyBody} onChange={(event) => setReplyBody(event.target.value)} required minLength={1} maxLength={5000} rows={5}
                      placeholder="Write a helpful reply…" style={{ ...fieldStyle, resize: 'vertical' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>The message is stored in this thread and sent through the mail outbox.</span>
                      <Btn type="submit" variant="accent" loading={reply.isPending} disabled={!replyBody.trim()}>Save and queue email</Btn>
                    </div>
                  </form>
                </Card>
                <Card pad={18}>
                  <form onSubmit={(event) => submitMessage(event, 'note')} style={{ display: 'grid', gap: 10 }}>
                    <label htmlFor="contact-note" style={{ color: 'var(--text)', fontWeight: 650, fontSize: 13.5 }}>Internal note</label>
                    <textarea id="contact-note" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} required minLength={1} maxLength={5000} rows={3}
                      placeholder="Only administrators can see this note" style={{ ...fieldStyle, resize: 'vertical' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn type="submit" variant="ghost" loading={note.isPending} disabled={!noteBody.trim()}>Add internal note</Btn></div>
                  </form>
                </Card>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <Card pad={16}>
                  <strong style={{ display: 'block', color: 'var(--text)', fontSize: 14, marginBottom: 12 }}>Assignment</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>{enquiry.assignedAdmin ? `Assigned to ${enquiry.assignedAdmin.name}` : 'Unassigned'}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn variant="ghost" disabled={assign.isPending || enquiry.assignedAdminId === user?.id} onClick={() => user?.id && assign.mutate(user.id)}>Assign to me</Btn>
                    {enquiry.assignedAdminId && <Btn variant="ghost" disabled={assign.isPending} onClick={() => assign.mutate(null)}>Unassign</Btn>}
                  </div>
                </Card>
                <Card pad={16}>
                  <strong style={{ display: 'block', color: 'var(--text)', fontSize: 14, marginBottom: 12 }}>Workflow</strong>
                  <label style={{ display: 'grid', gap: 6, color: 'var(--text-muted)', fontSize: 12.5 }}>
                    Status
                    <select value={status} onChange={(event) => setStatus(event.target.value as EnquiryStatus)} style={fieldStyle}>
                      {(['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'SPAM'] as EnquiryStatus[]).map((value) => <option key={value} value={value}>{statusText[value]}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6, marginTop: 10, color: 'var(--text-muted)', fontSize: 12.5 }}>
                    Priority
                    <select value={priority} onChange={(event) => setPriority(event.target.value as EnquiryPriority)} style={fieldStyle}>
                      {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as EnquiryPriority[]).map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 6, marginTop: 10, color: 'var(--text-muted)', fontSize: 12.5 }}>
                    Reason for change (10–500 characters)
                    <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
                  </label>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <Btn variant="ghost" disabled={updateStatus.isPending || reason.trim().length < 10 || status === enquiry.status} loading={updateStatus.isPending} onClick={() => updateStatus.mutate()}>Save status</Btn>
                    <Btn variant="ghost" disabled={updatePriority.isPending || reason.trim().length < 10 || priority === enquiry.priority} loading={updatePriority.isPending} onClick={() => updatePriority.mutate()}>Save priority</Btn>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                    <Pill tone={enquiry.status === 'NEW' ? 'lime' : 'amber'}>{statusText[enquiry.status]}</Pill>
                    <Pill tone={enquiry.priority === 'URGENT' || enquiry.priority === 'HIGH' ? 'red' : 'muted'}>{enquiry.priority}</Pill>
                  </div>
                </Card>
              </div>
            </div>
            <style jsx>{`@media(max-width: 820px){.contact-enquiry-grid{grid-template-columns:1fr!important}}`}</style>
          </>;
        })()}
      </>}
  </div>;
}
