'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { paymentApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store/authStore';
import { RL, Card, Pill, Btn, PageHead, Skel } from '../../../../components/rl-kit';
import { Check, Sparkles } from 'lucide-react';

declare global { interface Window { Razorpay?: any } }

function loadRzp(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const FEATURES: Record<string, string[]> = {
  free: ['Auto-DM on posts & Reels', '1 keyword per automation', 'Live status + delivery log', 'Unlimited contacts', '1 Instagram account'],
  pro: ['Everything in Free', 'Unlimited keywords', 'Stories, Lives & incoming DMs', 'Follow-ups & ask-to-follow', 'Break alerts & auto-reconnect', 'Up to 5 Instagram accounts'],
};

export default function BillingPage() {
  const { user, fetchMe } = useAuthStore();
  const [paying, setPaying] = useState(false);
  const sub = useQuery({ queryKey: ['subscription'], queryFn: async () => (await paymentApi.getSubscription()).data.data as { plan: string; planExpiresAt: string | null; active: boolean } });
  const current = sub.data?.plan ?? 'free';

  async function upgrade() {
    setPaying(true);
    try {
      const ok = await loadRzp();
      if (!ok) throw new Error('Could not load the payment window. Check your connection.');
      const order = (await paymentApi.createOrder()).data.data as { orderId: string; amount: number; currency: string; keyId: string };
      const rzp = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
        name: 'Relayo', description: 'Pro plan — monthly',
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#12807A' },
        handler: async (resp: any) => {
          try {
            await paymentApi.verify({ razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature });
            await Promise.all([sub.refetch(), fetchMe()]);
            toast.success('You’re on Pro now 🎉');
          } catch { toast.error('Payment captured but verification failed. Contact support.'); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on('payment.failed', (r: any) => toast.error(r?.error?.description ?? 'Payment failed'));
      rzp.open();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Could not start checkout');
    } finally { setPaying(false); }
  }

  async function cancel() {
    if (!confirm('Downgrade to Free? You’ll lose Pro features at the end of your period.')) return;
    try { await paymentApi.cancel(); await Promise.all([sub.refetch(), fetchMe()]); toast.success('Switched to Free'); }
    catch { toast.error('Could not cancel'); }
  }

  const plans = [
    { id: 'free', name: 'Free', price: '₹0', sub: 'For getting started' },
    { id: 'pro', name: 'Pro', price: '₹499', per: '/mo', sub: 'For creators who sell', popular: true },
  ];

  return (
    <div>
      <PageHead title="Billing" sub="One flat price, unlimited contacts. Your audience growing never makes Relayo cost more." />
      {sub.data?.active && sub.data.planExpiresAt && (
        <Card style={{ marginBottom: 18, maxWidth: 760, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14.5, color: RL.ink }}><strong>Pro</strong> active until {new Date(sub.data.planExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <Btn variant="ghost" onClick={cancel}>Switch to Free</Btn>
        </Card>
      )}
      {sub.isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 760 }}>{[0, 1].map((i) => <Skel key={i} h={360} />)}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 760 }}>
          {plans.map((p) => {
            const isCurrent = current === p.id;
            return (
              <Card key={p.id} pad={28} style={{ border: p.popular ? `2px solid ${RL.teal}` : `1px solid ${RL.line}`, position: 'relative', boxShadow: p.popular ? '0 24px 50px -28px rgba(18,128,122,.4)' : undefined }}>
                {p.popular && <span style={{ position: 'absolute', top: -12, left: 28, background: RL.teal, color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 999 }}>Most popular</span>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: RL.ink }}>{p.name}</span>
                  {isCurrent && <Pill tone="green" dot>Active</Pill>}
                </div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-1.5px', color: RL.ink, margin: '10px 0 2px' }}>{p.price}<span style={{ fontSize: 15, color: RL.muted, fontWeight: 500 }}>{p.per ?? ''}</span></div>
                <div style={{ fontSize: 13.5, color: RL.muted, marginBottom: 20 }}>{p.sub}</div>
                <div style={{ display: 'grid', gap: 11, marginBottom: 24 }}>
                  {FEATURES[p.id].map((f) => (<div key={f} style={{ display: 'flex', gap: 10, fontSize: 14, color: RL.ink }}><Check style={{ width: 17, height: 17, color: RL.teal, flexShrink: 0 }} />{f}</div>))}
                </div>
                {isCurrent ? <Btn variant="ghost" full disabled>Current plan</Btn>
                  : p.id === 'pro' ? <Btn variant="accent" full disabled={paying} onClick={upgrade}><Sparkles style={{ width: 16, height: 16 }} /> {paying ? 'Opening checkout…' : 'Upgrade to Pro'}</Btn>
                  : <Btn variant="ghost" full disabled>Included</Btn>}
              </Card>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 13, color: RL.muted, marginTop: 20 }}>Secure checkout by Razorpay · Prices in INR · Cancel anytime</p>
    </div>
  );
}
