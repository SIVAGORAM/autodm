'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareText, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { adminApi } from '../../../../../services/api';
import { Btn, Card, Empty, PageHead, Pill, Skel } from '../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../store/authStore';

type ContactStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED' | 'SPAM';
type Enquiry = {
  id: string; name: string; email: string; subject: string; status: ContactStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; assignedAdminId: string | null;
  assignedAdmin: { id: string; name: string; email: string } | null;
  createdAt: string; updatedAt: string; _count: { messages: number };
  messages: { kind: string; body: string; createdAt: string }[];
};
type EnquiriesPage = { page: number; pageSize: number; total: number; enquiries: Enquiry[]; hasMore: boolean };

const statuses: ContactStatus[] = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'SPAM'];
const label: Record<ContactStatus, string> = {
  NEW: 'New', IN_PROGRESS: 'In progress', WAITING_FOR_CUSTOMER: 'Waiting for customer', RESOLVED: 'Resolved', CLOSED: 'Closed', SPAM: 'Spam',
};

export default function ContactEnquiriesPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ContactStatus | ''>('NEW');
  const [assignment, setAssignment] = useState<'MINE' | 'UNASSIGNED' | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const query = useQuery({
    queryKey: ['admin', 'contact-enquiries', page, status, assignment, search],
    enabled: isAdmin,
    queryFn: async () => (await adminApi.contactEnquiries({ page, pageSize: 25, status: status || undefined, assigned: assignment || undefined, search: search || undefined })).data.data as EnquiriesPage,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (!isAdmin) return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
    <ShieldAlert size={26} color="var(--warning)" aria-hidden />
    <h1 style={{ margin: '12px 0 0', color: 'var(--text)', fontSize: 18 }}>Administrator access required</h1>
    <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Enquiry messages are visible only to active administrators.</p>
  </Card>;

  return <div>
    <PageHead title="Contact enquiries" sub="Manage public enquiries and reply from the HeyLaunch inbox. Email delivery status updates after the mail worker processes the reply."
      action={<Btn variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw size={15} aria-hidden />Refresh</Btn>} />
    <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>{query.data ? `${query.data.total.toLocaleString()} enquiry${query.data.total === 1 ? '' : 's'}` : 'New enquiries appear here.'}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12.5 }}>
          <Search size={14} aria-hidden />
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={100} placeholder="Name, email, or subject" aria-label="Search contact enquiries"
            style={{ minHeight: 38, width: 'min(58vw,260px)', padding: '0 10px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 12.5 }}>
          Status
          <select value={status} onChange={(event) => { setStatus(event.target.value as ContactStatus | ''); setPage(1); }}
            style={{ minHeight: 38, padding: '0 9px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="">All</option>{statuses.map((value) => <option key={value} value={value}>{label[value]}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 12.5 }}>
          Assigned
          <select value={assignment} onChange={(event) => { setAssignment(event.target.value as typeof assignment); setPage(1); }}
            style={{ minHeight: 38, padding: '0 9px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
            <option value="">Everyone</option><option value="MINE">Mine</option><option value="UNASSIGNED">Unassigned</option>
          </select>
        </label>
      </div>
    </Card>

    {query.isError ? <Card style={{ textAlign: 'center', padding: 30 }}><p role="alert" style={{ color: 'var(--error)' }}>Could not load enquiries.</p><Btn variant="ghost" onClick={() => query.refetch()}>Try again</Btn></Card>
      : query.isLoading ? <div style={{ display: 'grid', gap: 10 }}><Skel h={110} /><Skel h={110} /><Skel h={110} /></div>
        : !query.data?.enquiries.length ? <Empty icon={<MessageSquareText size={24} />} title="No matching enquiries" sub="New public contact messages will appear in this inbox." />
          : <>
            <div style={{ display: 'grid', gap: 10 }}>
              {query.data.enquiries.map((enquiry) => <Link key={enquiry.id} href={`/dashboard/admin/enquiries/${enquiry.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <Card pad={17}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--text)', fontSize: 14.5 }}>{enquiry.subject}</strong>
                        <Pill tone={enquiry.status === 'NEW' ? 'lime' : enquiry.status === 'SPAM' ? 'red' : enquiry.status === 'RESOLVED' || enquiry.status === 'CLOSED' ? 'green' : 'amber'}>{label[enquiry.status]}</Pill>
                        <Pill tone={enquiry.priority === 'URGENT' || enquiry.priority === 'HIGH' ? 'red' : 'muted'}>{enquiry.priority.toLowerCase()}</Pill>
                      </div>
                      <div style={{ marginTop: 7, color: 'var(--text-muted)', fontSize: 13 }}>{enquiry.name} · {enquiry.email}</div>
                      <p style={{ margin: '9px 0 0', color: 'var(--text-faint)', fontSize: 13, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {enquiry.messages[0]?.body || 'No messages yet'}
                      </p>
                    </div>
                    <div style={{ color: 'var(--text-faint)', fontSize: 12, textAlign: 'right' }}>
                      <div>{new Date(enquiry.updatedAt).toLocaleString()}</div>
                      <div style={{ marginTop: 5 }}>{enquiry._count.messages} message{enquiry._count.messages === 1 ? '' : 's'}</div>
                      <div style={{ marginTop: 5 }}>{enquiry.assignedAdmin?.name || 'Unassigned'}</div>
                    </div>
                  </div>
                </Card>
              </Link>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 18 }}>
              <Btn variant="ghost" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn>
              <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Page {page}</span>
              <Btn variant="ghost" disabled={!query.data?.hasMore || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Btn>
            </div>
          </>}
  </div>;
}
