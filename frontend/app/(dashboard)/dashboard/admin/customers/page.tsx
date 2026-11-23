'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, ShieldAlert, UsersRound } from 'lucide-react';
import { adminApi } from '../../../../../services/api';
import { Btn, Card, Empty, PageHead, Pill, Skel } from '../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../store/authStore';

type CustomerStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION';
type CustomerPlan = 'FREE' | 'CREATOR' | 'PRO' | 'AGENCY' | 'PAID';
type Customer = {
  id: string; name: string; email: string; plan: string; planExpiresAt: string | null; isVerified: boolean;
  createdAt: string; suspendedAt: string | null; suspensionReason: string | null; deletionRequestedAt: string | null;
  instagramAccountCount: number; activeInstagramAccountCount: number; automationCount: number;
};
type CustomerPage = { page: number; pageSize: number; total: number; customers: Customer[]; hasMore: boolean };

function statusOf(customer: Customer): CustomerStatus {
  if (customer.deletionRequestedAt) return 'PENDING_DELETION';
  return customer.suspendedAt ? 'SUSPENDED' : 'ACTIVE';
}

export default function AdminCustomersPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerStatus | ''>('');
  const [plan, setPlan] = useState<CustomerPlan | ''>('');
  const [page, setPage] = useState(1);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const query = useQuery({
    queryKey: ['admin', 'customers', page, search, status, plan],
    enabled: isSuperAdmin,
    queryFn: async () => (await adminApi.customers({ page, pageSize: 25, search: search || undefined, status: status || undefined, plan: plan || undefined })).data.data as CustomerPage,
  });
  const lifecycle = useMutation({
    mutationFn: ({ id, operation, reason }: { id: string; operation: 'suspend' | 'reactivate'; reason: string }) =>
      operation === 'suspend' ? adminApi.suspendCustomer(id, reason) : adminApi.reactivateCustomer(id, reason),
    onSuccess: async (_result, variables) => {
      toast.success(variables.operation === 'suspend'
        ? 'Customer suspended. Their sessions were revoked and live automations paused.'
        : 'Customer reactivated. Their automations remain paused until the creator turns them on.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not update this customer.'),
  });

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPage(1); setSearch(searchInput.trim());
  }

  if (!isSuperAdmin) return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
    <ShieldAlert style={{ width: 26, height: 26, color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden />
    <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Super Admin access required</h1>
    <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Customer administration is restricted to Super Admins.</p>
  </Card>;

  return <div>
    <PageHead title="Customer directory" sub="Search customer accounts and review plan, Instagram connection, automation, and lifecycle status." />
    <Card style={{ marginBottom: 16 }}>
      <form onSubmit={applyFilters} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) repeat(2,minmax(130px,180px)) auto', gap: 10, alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12.5 }}>
          Search by name, email, or ID
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={80} placeholder="Search customers"
            style={{ minHeight: 40, padding: '0 11px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }} />
        </label>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12.5 }}>Status
          <select value={status} onChange={(event) => { setStatus(event.target.value as CustomerStatus | ''); setPage(1); }}
            style={{ minHeight: 40, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }}>
            <option value="">All</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="PENDING_DELETION">Pending deletion</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12.5 }}>Plan
          <select value={plan} onChange={(event) => { setPlan(event.target.value as CustomerPlan | ''); setPage(1); }}
            style={{ minHeight: 40, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }}>
            <option value="">All plans</option><option value="FREE">Free</option><option value="CREATOR">Creator</option><option value="PRO">Pro</option><option value="AGENCY">Agency</option>
          </select>
        </label>
        <Btn type="submit" variant="accent"><Search style={{ width: 15, height: 15 }} aria-hidden /> Search</Btn>
      </form>
    </Card>

    {query.isError ? <Card style={{ textAlign: 'center', padding: 28 }}>
      <p role="alert" style={{ color: 'var(--error)', margin: '0 0 12px' }}>Could not load customers.</p>
      <Btn variant="ghost" onClick={() => query.refetch()}>Try again</Btn>
    </Card> : query.isLoading ? <div style={{ display: 'grid', gap: 10 }}><Skel h={96} /><Skel h={96} /><Skel h={96} /></div>
      : query.data?.customers.length ? <>
        <Card style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>{query.data.total.toLocaleString()} customer{query.data.total === 1 ? '' : 's'}</Card>
        <div style={{ display: 'grid', gap: 9 }}>
          {query.data.customers.map((customer) => {
            const customerStatus = statusOf(customer);
            return <CustomerRow key={customer.id} customer={customer} status={customerStatus} pending={lifecycle.isPending}
              onLifecycle={(operation, reason) => lifecycle.mutate({ id: customer.id, operation, reason })} />;
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 18 }}>
          <Btn variant="ghost" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn>
          <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Page {page}</span>
          <Btn variant="ghost" disabled={!query.data.hasMore || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Btn>
        </div>
      </> : <Empty icon={<UsersRound style={{ width: 24, height: 24 }} />} title="No customers found" sub="Try changing the search or filters." />}
  </div>;
}

function CustomerRow({ customer, status, pending, onLifecycle }: {
  customer: Customer; status: CustomerStatus; pending: boolean; onLifecycle: (operation: 'suspend' | 'reactivate', reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return <Card pad={16}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 310px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/dashboard/admin/customers/${customer.id}`} style={{ color: 'var(--text)', fontSize: 14, fontWeight: 650, textDecoration: 'none' }} className="rl-nav">{customer.name}</Link>
          <Pill tone={status === 'ACTIVE' ? 'green' : status === 'SUSPENDED' ? 'amber' : 'muted'} dot>{status.replace('_', ' ')}</Pill>
          <Pill tone="violet">{customer.plan}</Pill>
          {!customer.isVerified && <Pill tone="amber">Unverified</Pill>}
        </div>
        <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 12.5, overflowWrap: 'anywhere' }}>{customer.email} · {customer.id}</div>
        <div style={{ marginTop: 5, color: 'var(--text-faint)', fontSize: 12.5 }}>
          Joined {new Date(customer.createdAt).toLocaleDateString()} · {customer.activeInstagramAccountCount}/{customer.instagramAccountCount} active Instagram · {customer.automationCount} automations
        </div>
        {customer.suspensionReason && <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 12 }}>Suspension reason: {customer.suspensionReason}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
        {status !== 'PENDING_DELETION' && <label style={{ display: 'grid', gap: 4, color: 'var(--text-muted)', fontSize: 11.5 }}>
          {status === 'SUSPENDED' ? 'Reactivation reason' : 'Suspension reason'}
          <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500}
            aria-label={`${status === 'SUSPENDED' ? 'Reactivation' : 'Suspension'} reason for ${customer.email}`}
            style={{ width: 'min(245px,68vw)', minHeight: 36, padding: '0 9px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
        </label>}
        {status === 'PENDING_DELETION' ? <span title="The account is disabled and its queued deletion will run after active work drains."><Btn variant="ghost" disabled>Deletion queued</Btn></span>
          : <Btn variant="ghost" disabled={pending || reason.trim().length < 10}
            onClick={() => {
              const action = status === 'SUSPENDED' ? 'reactivate' : 'suspend';
              if (!window.confirm(`${action === 'suspend' ? 'Suspend' : 'Reactivate'} ${customer.email}? ${action === 'suspend' ? 'Sessions will be revoked and live automations paused.' : 'Automations will remain paused.'}`)) return;
              onLifecycle(action, reason.trim());
            }}>{status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}</Btn>}
      </div>
    </div>
  </Card>;
}
