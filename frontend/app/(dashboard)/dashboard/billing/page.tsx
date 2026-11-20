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

type Plan = {
  id: string; tier: string; name: string; tagline?: string;
  price: string; per?: string; pricePaise: number;
  accountCap: number; dmQuota: number; highlights: string[];
};
type Sub = {
  plan: string; tier: string; name: string; active: boolean; isPaid: boolean; paidTier: string | null;
  trial: { active: boolean; endsAt: string | null }; planExpiresAt: string | null;
  limits: { accountCap: number; dmQuota: number };
  usage: { accountsUsed: number; dmUsed: number; dmResetAt: string | null };
};

function Meter({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(total, 1)) * 100));
  const near = pct >= 80 && pct < 100;
  const over = used >= total;
  const bar = over ? RL.coral : near ? '#E8A317' : RL.teal;
  return (
    <div style={{ minWidth: 220, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: RL.muted, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color: over ? RL.coral : RL.ink, fontWeight: 600 }}>{used.toLocaleString('en-IN')} / {total.toLocaleString('en-IN')}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: RL.line, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: bar, borderRadius: 999, transition: 'width .4s ease' }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { user, fetchMe } = useAuthStore();
  const [paying, setPaying] = useState<string | null>(null);

  const plansQ = useQuery({ queryKey: ['plans'], queryFn: async () => (await paymentApi.getPlans()).data.data as Plan[] });
  const sub = useQuery({ queryKey: ['subscription'], queryFn: async () => (await paymentApi.getSubscription()).data.data as Sub });

  const plans = plansQ.data ?? [];
  const s = sub.data;

  async function upgrade(plan: Plan) {
    setPaying(plan.tier);
    try {
      const ok = await loadRzp();
      if (!ok) throw new Error('Could not load the payment window. Check your connection.');
      const order = (await paymentApi.createOrder(plan.tier)).data.data as { orderId: string; amount: number; currency: string; keyId: string; planName: string };
      const rzp = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
        name: 'Relayo', description: `${order.planName} plan — monthly`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#12807A' },
        handler: async (resp: any) => {
          try {
            await paymentApi.verify({ razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature });
            await Promise.all([sub.refetch(), fetchMe()]);
            toast.success(`You’re on ${plan.name} now 🎉`);
          } catch { toast.error('Payment captured but verification failed. Contact support.'); }
        },
        modal: { ondismiss: () => setPaying(null) },
      });
      rzp.on('payment.failed', (r: any) => toast.error(r?.error?.description ?? 'Payment failed'));
      rzp.open();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Could not start checkout');
    } finally { setPaying(null); }
  }

  async function cancel() {
    if (!confirm('Switch to Free? You’ll keep paid features until your current period ends.')) return;
    try { await paymentApi.cancel(); await Promise.all([sub.refetch(), fetchMe()]); toast.success('Switched to Free'); }
    catch { toast.error('Could not switch plan'); }
  }

  return (
    <div>
      <PageHead title="Plans & usage" sub="Pick the plan that fits how you grow. Limits update live as you use Relayo." />

      {/* Live usage meter */}
      {s && (
        <Card style={{ marginBottom: 18, maxWidth: 1080, display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 14.5, color: RL.ink, fontWeight: 700, minWidth: 120 }}>
            {s.name} plan
            {s.trial.active && !s.isPaid && <Pill tone="green" dot>Trial</Pill>}
          </div>
          <Meter label="DMs this month" used={s.usage.dmUsed} total={s.limits.dmQuota} />
          <Meter label="Instagram accounts" used={s.usage.accountsUsed} total={s.limits.accountCap} />
        </Card>
      )}

      {/* Status banners */}
      {s?.isPaid && s.planExpiresAt && (
        <Card style={{ marginBottom: 18, maxWidth: 1080, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14.5, color: RL.ink }}><strong>{s.name}</strong> active until {new Date(s.planExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <Btn variant="ghost" onClick={cancel}>Switch to Free</Btn>
        </Card>
      )}
      {!s?.isPaid && s?.trial?.active && (
        <Card style={{ marginBottom: 18, maxWidth: 1080, borderColor: RL.tealSoft, background: `linear-gradient(90deg, ${RL.tealSoft}66, #fff 60%)` }}>
          <div style={{ fontSize: 14.5, color: RL.ink }}>✨ You&rsquo;re on a <strong>free trial</strong> with full Pro access. Upgrade before it ends to keep every feature.</div>
        </Card>
      )}

      {/* Plan cards */}
      {plansQ.isLoading || sub.isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 1080 }}>{[0, 1, 2, 3].map((i) => <Skel key={i} h={420} />)}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 1080 }}>
          {plans.map((p) => {
            const isPaidCurrent = !!s?.isPaid && s?.tier === p.tier;
            const isFreeCurrent = !s?.isPaid && !s?.trial?.active && p.tier === 'FREE';
            const isCurrent = isPaidCurrent || isFreeCurrent;
            const popular = p.tier === 'PRO';
            return (
              <Card key={p.id} pad={26} style={{ border: popular ? `2px solid ${RL.teal}` : `1px solid ${RL.line}`, position: 'relative', boxShadow: popular ? '0 24px 50px -28px rgba(18,128,122,.4)' : undefined }}>
                {popular && <span style={{ position: 'absolute', top: -12, left: 26, background: RL.teal, color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 999 }}>Most popular</span>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: RL.ink }}>{p.name}</span>
                  {isCurrent && <Pill tone="green" dot>Active</Pill>}
                </div>
                <div style={{ fontSize: 13, color: RL.muted, marginTop: 2 }}>{p.tagline}</div>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', color: RL.ink, margin: '12px 0 2px' }}>{p.price}<span style={{ fontSize: 14, color: RL.muted, fontWeight: 500 }}>{p.per ?? ''}</span></div>
                <div style={{ display: 'grid', gap: 9, margin: '18px 0 22px' }}>
                  {p.highlights.map((f) => (<div key={f} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: RL.ink, lineHeight: 1.3 }}><Check style={{ width: 16, height: 16, color: RL.teal, flexShrink: 0, marginTop: 1 }} />{f}</div>))}
                </div>
                {isCurrent ? (
                  <Btn variant="ghost" full disabled>Current plan</Btn>
                ) : p.tier === 'FREE' ? (
                  <Btn variant="ghost" full disabled>Free forever</Btn>
                ) : (
                  <Btn variant={popular ? 'accent' : 'primary'} full disabled={!!paying} onClick={() => upgrade(p)}>
                    <Sparkles style={{ width: 15, height: 15 }} /> {paying === p.tier ? 'Opening…' : `Upgrade to ${p.name}`}
                  </Btn>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 13, color: RL.muted, marginTop: 20 }}>Secure checkout by Razorpay · Prices in INR · Cancel anytime</p>
    </div>
  );
}
