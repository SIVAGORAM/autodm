'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Instagram, ShieldAlert, ShieldCheck } from 'lucide-react';
import { adminApi } from '../../../../../../services/api';
import { Btn, Card, PageHead, Pill, Skel } from '../../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../../store/authStore';

type CustomerDetail = {
  id: string; name: string; email: string; plan: string; planExpiresAt: string | null; trialEndsAt: string | null;
  isVerified: boolean; createdAt: string; updatedAt: string; suspendedAt: string | null; suspensionReason: string | null; deletionRequestedAt: string | null;
  _count: { supportRequests: number; payments: number };
  igAccounts: { id: string; username: string; loginMode: string; isActive: boolean; tokenExpiresAt: string | null; webhookSubscribedAt: string | null; createdAt: string;
    automations: { id: string; name: string; triggerType: string; status: string; updatedAt: string }[] }[];
};

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const query = useQuery({
    queryKey: ['admin', 'customer', id],
    enabled: isSuperAdmin && !!id,
    queryFn: async () => (await adminApi.customer(id)).data.data as CustomerDetail,
  });
  const lifecycle = useMutation({
    mutationFn: (operation: 'suspend' | 'reactivate') => operation === 'suspend'
      ? adminApi.suspendCustomer(id, reason.trim()) : adminApi.reactivateCustomer(id, reason.trim()),
    onSuccess: async (_result, operation) => {
      setReason('');
      toast.success(operation === 'suspend' ? 'Customer suspended; live automations paused.' : 'Customer reactivated; automations remain paused.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'customer', id] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] }),
      ]);
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not update this customer.'),
  });

  if (!isSuperAdmin) return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
    <ShieldAlert style={{ width: 26, height: 26, color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden />
    <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Super Admin access required</h1>
  </Card>;
  if (query.isError) return <Card style={{ maxWidth: 640, margin: '24px auto', padding: 28, textAlign: 'center' }}>
    <p role="alert" style={{ color: 'var(--error)', margin: '0 0 12px' }}>Could not load this customer.</p>
    <Btn variant="ghost" onClick={() => query.refetch()}>Try again</Btn>
  </Card>;
  if (!query.data) return <div style={{ display: 'grid', gap: 10 }}><Skel h={150} /><Skel h={190} /></div>;

  const customer = query.data;
  const status = customer.deletionRequestedAt ? 'PENDING DELETION' : customer.suspendedAt ? 'SUSPENDED' : 'ACTIVE';
  const operation = customer.suspendedAt ? 'reactivate' : 'suspend';
  return <div>
    <Link href="/dashboard/admin/customers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13, marginBottom: 14 }}>
      <ArrowLeft style={{ width: 15, height: 15 }} aria-hidden /> Customer directory
    </Link>
    <PageHead title={customer.name} sub={customer.email} />

    <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill tone={status === 'ACTIVE' ? 'green' : status === 'SUSPENDED' ? 'amber' : 'muted'} dot>{status}</Pill>
        <Pill tone="violet">{customer.plan}</Pill>
        <Pill tone={customer.isVerified ? 'green' : 'amber'}>{customer.isVerified ? 'Email verified' : 'Unverified'}</Pill>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>Customer ID: {customer.id}</div>
    </Card>

    {status !== 'PENDING DELETION' && <Card style={{ marginBottom: 14, borderColor: customer.suspendedAt ? 'var(--warning-soft)' : 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <strong style={{ color: 'var(--text)', fontSize: 14 }}>{customer.suspendedAt ? 'Account suspended' : 'Account active'}</strong>
          <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.55 }}>
            {customer.suspendedAt
              ? 'The customer cannot sign in, active sessions are invalidated, and live automations were paused. Reactivation does not restart automations.'
              : 'Suspending prevents new authenticated access, invalidates active sessions, and pauses live automations. It does not delete customer data.'}
          </p>
          {customer.suspensionReason && <p style={{ margin: '6px 0 0', color: 'var(--text-faint)', fontSize: 12 }}>Reason: {customer.suspensionReason}</p>}
        </div>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>
          {customer.suspendedAt ? 'Reactivation' : 'Suspension'} reason
          <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} minLength={10}
            style={{ width: 'min(300px,70vw)', minHeight: 38, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
        </label>
        <Btn variant={operation === 'suspend' ? 'ghost' : 'accent'} loading={lifecycle.isPending} disabled={reason.trim().length < 10}
          onClick={() => {
            if (!window.confirm(`${operation === 'suspend' ? 'Suspend' : 'Reactivate'} ${customer.email}?`)) return;
            lifecycle.mutate(operation);
          }}>{operation === 'suspend' ? 'Suspend account' : 'Reactivate account'}</Btn>
      </div>
    </Card>}
    {customer.deletionRequestedAt && <Card style={{ marginBottom: 14 }}>
      <strong style={{ color: 'var(--text)' }}>Deletion requested</strong>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.55, marginBottom: 0 }}>
        Requested {new Date(customer.deletionRequestedAt).toLocaleString()}. The account was disabled, its sessions revoked, Instagram credentials cleared, and automations paused at request time. A background worker permanently removes remaining account-owned data after the safety window and once active queue work has drained. Payment references are retained without the customer link. This product has no admin approval, cancellation, or restore control for deletion requests.
      </p>
    </Card>}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 12, marginBottom: 14 }}>
      <Card><div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Customer since</div><strong style={{ display: 'block', marginTop: 7, color: 'var(--text)', fontSize: 14 }}>{new Date(customer.createdAt).toLocaleString()}</strong></Card>
      <Card><div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Plan expires</div><strong style={{ display: 'block', marginTop: 7, color: 'var(--text)', fontSize: 14 }}>{customer.planExpiresAt ? new Date(customer.planExpiresAt).toLocaleDateString() : 'No paid expiry recorded'}</strong></Card>
      <Card><div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Support requests · payment records</div><strong style={{ display: 'block', marginTop: 7, color: 'var(--text)', fontSize: 14 }}>{customer._count.supportRequests} · {customer._count.payments}</strong></Card>
    </div>

    <PageHead title="Instagram accounts and automations" sub="Operational status only. Access tokens, comment contents, and private message bodies are not exposed here." />
    {customer.igAccounts.length ? <div style={{ display: 'grid', gap: 10 }}>
      {customer.igAccounts.map((account) => <Card key={account.id} pad={16}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Instagram style={{ width: 18, height: 18, color: 'var(--text-muted)' }} aria-hidden />
            <strong style={{ color: 'var(--text)', fontSize: 14 }}>@{account.username}</strong>
            <Pill tone={account.isActive ? 'green' : 'muted'}>{account.isActive ? 'Connected' : 'Disconnected'}</Pill>
          </div>
          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{account.loginMode.replace('_', ' ')} · webhooks {account.webhookSubscribedAt ? 'subscribed' : 'unconfirmed'}</span>
        </div>
        <div style={{ display: 'grid', gap: 7, marginTop: 12 }}>
          {account.automations.length ? account.automations.map((automation) => <div key={automation.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border-soft)', paddingTop: 8 }}>
            <span style={{ color: 'var(--text)', fontSize: 13, overflowWrap: 'anywhere' }}>{automation.name} <span style={{ color: 'var(--text-faint)' }}>· {automation.triggerType.replaceAll('_', ' ')}</span></span>
            <Pill tone={automation.status === 'LIVE' ? 'green' : 'muted'}>{automation.status}</Pill>
          </div>) : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>No automations</span>}
        </div>
      </Card>)}
    </div> : <Card style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
      <ShieldCheck style={{ width: 22, height: 22, marginBottom: 7 }} aria-hidden /><div>No Instagram accounts connected.</div>
    </Card>}
  </div>;
}
