'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Search } from 'lucide-react';
import { adminApi } from '../../../../../services/api';
import { Btn, Card, Empty, PageHead, Pill, Skel } from '../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../store/authStore';

type RecordedCurrency = { currency: string; count: number; amountMinorUnits: number };
type Payment = {
  id: string; orderId: string; paymentId: string; plan: string; amount: number; currency: string;
  createdAt: string; user: { id: string; name: string; email: string } | null;
};
type Ledger = { page: number; pageSize: number; total: number; hasMore: boolean; payments: Payment[]; recordedCaptures: RecordedCurrency[]; limitations: string[] };

function formatMinorUnits(amount: number, currency: string) {
  try {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount / (10 ** digits));
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function AdminBillingPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [currency, setCurrency] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const query = useQuery({
    queryKey: ['admin', 'billing-ledger', { search, plan, currency, from, to, page }],
    enabled: isSuperAdmin,
    queryFn: async () => (await adminApi.paymentLedger({
      page, pageSize: 25, search: search.trim() || undefined,
      plan: (plan || undefined) as 'FREE' | 'CREATOR' | 'PRO' | 'AGENCY' | undefined,
      currency: currency.trim() || undefined, from: from || undefined, to: to || undefined,
    })).data.data as Ledger,
  });

  if (!isSuperAdmin) return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
    <CreditCard style={{ width: 26, height: 26, color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden />
    <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Super Admin access required</h1>
  </Card>;

  const changeFilter = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1); };
  return <div>
    <PageHead title="Billing ledger" sub="Review provider-verified payment captures recorded by HeyLaunch. This is a payment ledger, not net revenue or a subscription history." />

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 12, marginBottom: 18 }}>
      {query.data?.recordedCaptures.map((capture) => <Card key={capture.currency} pad={16}>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Recorded captures · {capture.currency}</div>
        <div style={{ marginTop: 8, color: 'var(--text)', fontSize: 23, fontWeight: 700 }}>{formatMinorUnits(capture.amountMinorUnits, capture.currency)}</div>
        <div style={{ marginTop: 4, color: 'var(--text-faint)', fontSize: 12 }}>{capture.count} verified payment{capture.count === 1 ? '' : 's'} in current filter</div>
      </Card>)}
      {query.isLoading && <><Skel h={96} /><Skel h={96} /></>}
      {!query.isLoading && !query.isError && query.data?.recordedCaptures.length === 0 && <Card pad={16} style={{ color: 'var(--text-muted)', fontSize: 13 }}>No captured payments match these filters.</Card>}
    </div>

    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,170px),1fr))', gap: 10, alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>
          Search customer or payment ID
          <span style={{ position: 'relative' }}><Search aria-hidden style={{ position: 'absolute', left: 10, top: 11, width: 15, height: 15, color: 'var(--text-faint)' }} />
            <input value={search} onChange={(event) => changeFilter(setSearch)(event.target.value)} maxLength={100} placeholder="Email, order, payment…"
              style={{ width: '100%', minHeight: 38, padding: '0 10px 0 32px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
          </span>
        </label>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>Plan
          <select value={plan} onChange={(event) => changeFilter(setPlan)(event.target.value)} style={{ minHeight: 38, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <option value="">All plans</option><option value="CREATOR">Creator</option><option value="PRO">Pro</option><option value="AGENCY">Agency</option><option value="FREE">Free</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>Currency
          <input value={currency} onChange={(event) => changeFilter(setCurrency)(event.target.value.toUpperCase())} maxLength={3} pattern="[A-Za-z]{3}" placeholder="INR"
            style={{ minHeight: 38, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
        </label>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>From (UTC)
          <input type="date" value={from} onChange={(event) => changeFilter(setFrom)(event.target.value)} style={{ minHeight: 38, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
        </label>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>To (UTC)
          <input type="date" value={to} onChange={(event) => changeFilter(setTo)(event.target.value)} style={{ minHeight: 38, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
        </label>
      </div>
      {from && to && from > to && <p role="alert" style={{ margin: '10px 0 0', color: 'var(--error)', fontSize: 12 }}>End date must be on or after start date.</p>}
    </Card>

    {query.isError ? <Card style={{ textAlign: 'center', padding: 28 }}>
      <p role="alert" style={{ color: 'var(--error)', margin: '0 0 12px' }}>Could not load recorded payments.</p><Btn variant="ghost" onClick={() => query.refetch()}>Try again</Btn>
    </Card> : query.isLoading ? <div style={{ display: 'grid', gap: 10 }}><Skel h={70} /><Skel h={70} /><Skel h={70} /></div>
      : query.data?.payments.length ? <>
        <div style={{ display: 'grid', gap: 9 }}>
          {query.data.payments.map((payment) => <Card key={payment.id} pad={15}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <strong style={{ color: 'var(--text)', fontSize: 14 }}>{payment.user?.name ?? 'Account no longer available'}</strong>
                  <Pill tone="green">Captured</Pill><Pill tone="violet">{payment.plan}</Pill>
                </div>
                <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 12, overflowWrap: 'anywhere' }}>{payment.user?.email ?? 'Customer data unavailable'}</div>
                <div style={{ marginTop: 8, color: 'var(--text-faint)', fontSize: 11, overflowWrap: 'anywhere' }}>Order {payment.orderId} · Payment {payment.paymentId}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ color: 'var(--text)', fontSize: 16 }}>{formatMinorUnits(payment.amount, payment.currency)}</strong>
                <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 12 }}>{new Date(payment.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </Card>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{query.data.total} payment records · page {page}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Btn>
            <Btn variant="ghost" disabled={!query.data.hasMore} onClick={() => setPage((value) => value + 1)}>Next</Btn>
          </div>
        </div>
      </> : <Empty icon={<CreditCard style={{ width: 24, height: 24 }} />} title="No payment records" sub="Verified captured payments appear here after provider reconciliation." />}

    {query.data?.limitations.map((limitation) => <p key={limitation} style={{ margin: '12px 2px 0', color: 'var(--text-faint)', fontSize: 11 }}>{limitation}</p>)}
  </div>;
}
