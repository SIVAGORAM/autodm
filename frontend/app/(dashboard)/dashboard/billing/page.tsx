'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { paymentApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store/authStore';
import { RL, Card, Pill, Btn, PageHead, Skel } from '../../../../components/rl-kit';
import { Check, Sparkles } from 'lucide-react';
import { LEGAL_POLICIES_APPROVED } from '../../../../lib/legal-policy';

// Keep Razorpay test checkout available in development/staging. Production
// checkout is hidden until the same policy approval gate used by the API is set.
const CHECKOUT_ENABLED = process.env.NODE_ENV !== 'production' || LEGAL_POLICIES_APPROVED;

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
  const bar = over ? 'var(--error)' : near ? 'var(--warning)' : 'var(--lime)';
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
  const sub = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => (await paymentApi.getSubscription()).data.data as Sub,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const checkoutDataReady = !plansQ.isLoading && !sub.isLoading && !plansQ.isError && !sub.isError && !!plansQ.data && !!sub.data;

  const plans = plansQ.data ?? [];
  const s = sub.data;
  const trialEndLabel = s?.trial.endsAt
    ? new Date(s.trial.endsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  async function upgrade(plan: Plan) {
    if (!CHECKOUT_ENABLED) {
      toast.error('Checkout is temporarily unavailable while the legal policies are being finalized.');
      return;
    }
    if (!checkoutDataReady) {
      toast.error('Plan and usage details must load successfully before checkout. Please refresh and try again.');
      return;
    }
    setPaying(plan.tier);
    try {
      const ok = await loadRzp();
      if (!ok) throw new Error('Could not load the payment window. Check your connection.');
      const order = (await paymentApi.createOrder(plan.tier)).data.data as { orderId: string; amount: number; currency: string; keyId: string; planName: string };
      const rzp = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
        name: 'HeyLaunch', description: `${order.planName} plan — 30 days`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#17171B' },
        handler: async (resp: any) => {
          const previousExpiry = s?.planExpiresAt ? new Date(s.planExpiresAt).getTime() : null;
          const toastId = toast.loading('Payment received. Confirming your plan…');
          try {
            const verification = (await paymentApi.verify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            })).data.data as Sub & { paymentApplied?: boolean };
            if (verification.paymentApplied === false) {
              toast.error('Your payment was recorded, but plan access was not restored because account deletion is underway. Please contact HeyLaunch support to resolve the charge.', { id: toastId });
              return;
            }
            await Promise.all([sub.refetch(), fetchMe()]);
            toast.success(`You’re on ${plan.name} now 🎉`, { id: toastId });
          } catch {
            // The capture webhook can activate a plan even if this browser
            // callback cannot reach the API. Re-read server state briefly
            // before asking the customer to wait or contact support.
            let activated = false;
            for (let attempt = 0; attempt < 8; attempt += 1) {
              if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 1500));
              let refreshed;
              try { refreshed = await sub.refetch(); } catch { continue; }
              const current = refreshed.data as Sub | undefined;
              const currentExpiry = current?.planExpiresAt ? new Date(current.planExpiresAt).getTime() : null;
              if (current?.isPaid && current.paidTier === plan.tier && currentExpiry !== null &&
                  (previousExpiry === null || currentExpiry > previousExpiry)) {
                activated = true;
                break;
              }
            }
            if (activated) {
              await fetchMe().catch(() => undefined);
              toast.success(`You’re on ${plan.name} now 🎉`, { id: toastId });
            } else {
              toast.info('Your checkout completed. Plan activation is still confirming; check Plans & usage again in a moment.', { id: toastId });
            }
          }
        },
        modal: { ondismiss: () => setPaying(null) },
      });
      rzp.on('payment.failed', (r: any) => toast.error(r?.error?.description ?? 'Payment failed'));
      rzp.open();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Could not start checkout');
    } finally { setPaying(null); }
  }


  return (
    <div>
      <PageHead title="Plans & usage" sub="Review your current plan, account limits, and usage before making a purchase." />

      {!CHECKOUT_ENABLED && (
        <Card style={{ marginBottom: 18, maxWidth: 1080, borderColor: 'var(--warning)' }}>
          <div role="status" style={{ fontSize: 14, color: RL.ink }}>
            Paid checkout is temporarily unavailable while the Terms, Privacy, and Refund policies are finalized. Your current plan and usage are unaffected.
          </div>
        </Card>
      )}

      {(plansQ.isError || sub.isError) && (
        <Card style={{ marginBottom: 18, maxWidth: 1080, borderColor: 'var(--error)' }}>
          <div role="alert" style={{ color: RL.ink, fontSize: 14, lineHeight: 1.5 }}>
            {plansQ.isError && sub.isError
              ? 'Plans and current usage could not be refreshed.'
              : plansQ.isError ? 'Plans could not be refreshed.' : 'Your current plan and usage could not be refreshed.'}
            {(plansQ.data || sub.data) ? ' Any details still shown are from the last successful load.' : ' Checkout is disabled until both are available.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {plansQ.isError && <Btn variant="ghost" onClick={() => void plansQ.refetch()}>Retry plans</Btn>}
            {sub.isError && <Btn variant="ghost" onClick={() => void sub.refetch()}>Retry usage</Btn>}
          </div>
        </Card>
      )}

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
          <div style={{ fontSize: 14.5, color: RL.ink }}><strong>{s.name}</strong> access through {new Date(s.planExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. This is a one-time 30-day plan; renew manually to keep these limits.</div>
        </Card>
      )}
      {!s?.isPaid && s?.trial?.active && (
        <Card style={{ marginBottom: 18, maxWidth: 1080, background: 'var(--card)' }}>
          <div style={{ fontSize: 14.5, color: RL.ink }}>✨ You&rsquo;re on a <strong>free trial</strong> with full Pro access. {trialEndLabel ? <>It ends <strong>{trialEndLabel}</strong> (your local time). Upgrade before then to keep every feature.</> : 'Upgrade before it ends to keep every feature.'}</div>
        </Card>
      )}

      {/* Plan cards */}
      {plansQ.isLoading || sub.isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 1080 }}>{[0, 1, 2, 3].map((i) => <Skel key={i} h={420} />)}</div>
      ) : (plansQ.isError && !plansQ.data) || (sub.isError && !sub.data) ? (
        <Card style={{ maxWidth: 1080 }}>
          <p role="alert" style={{ color: RL.ink, margin: 0, fontSize: 14 }}>Plan options are unavailable until plans and account usage load successfully.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, maxWidth: 1080 }}>
          {plans.map((p) => {
            const isPaidCurrent = !!s?.isPaid && s?.tier === p.tier;
            const isFreeCurrent = !s?.isPaid && !s?.trial?.active && p.tier === 'FREE';
            const isCurrent = isPaidCurrent || isFreeCurrent;
            const isDowngrade = !!s?.isPaid && ['FREE', 'CREATOR', 'PRO', 'AGENCY'].indexOf(p.tier) < ['FREE', 'CREATOR', 'PRO', 'AGENCY'].indexOf(s.tier);
            const popular = p.tier === 'PRO';
            return (
              <Card key={p.id} pad={26} style={{ border: popular ? `2px solid var(--text)` : `1px solid var(--border)`, position: 'relative', boxShadow: popular ? 'var(--shadow-lg)' : undefined }}>
                {popular && <span style={{ position: 'absolute', top: -12, left: 26, background: 'var(--lime)', color: 'var(--on-lime)', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 999 }}>Most popular</span>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: RL.ink }}>{p.name}</span>
                  {isCurrent && <Pill tone="green" dot>Active</Pill>}
                </div>
                <div style={{ fontSize: 13, color: RL.muted, marginTop: 2 }}>{p.tagline}</div>
                <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px', color: RL.ink, margin: '12px 0 2px' }}>{p.price}<span style={{ fontSize: 14, color: RL.muted, fontWeight: 500 }}>{p.per ?? ''}</span></div>
                <div style={{ display: 'grid', gap: 9, margin: '18px 0 22px' }}>
                  {p.highlights.map((f) => (<div key={f} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: RL.ink, lineHeight: 1.3 }}><Check style={{ width: 16, height: 16, color: RL.teal, flexShrink: 0, marginTop: 1 }} />{f}</div>))}
                </div>
                {isPaidCurrent ? (
                  <Btn variant="ghost" full disabled={!CHECKOUT_ENABLED || !checkoutDataReady || !!paying} onClick={() => upgrade(p)}>
                    <Sparkles style={{ width: 15, height: 15 }} /> {paying === p.tier ? 'Opening…' : `Renew ${p.name}`}
                  </Btn>
                ) : isFreeCurrent ? (
                  <Btn variant="ghost" full disabled>Current plan</Btn>
                ) : p.tier === 'FREE' ? (
                  <Btn variant="ghost" full disabled>Free forever</Btn>
                ) : isDowngrade ? (
                  <Btn variant="ghost" full disabled>Current plan includes this</Btn>
                ) : (
                  <Btn variant={popular ? 'accent' : 'primary'} full disabled={!CHECKOUT_ENABLED || !checkoutDataReady || !!paying} onClick={() => upgrade(p)}>
                    <Sparkles style={{ width: 15, height: 15 }} /> {paying === p.tier ? 'Opening…' : `Upgrade to ${p.name}`}
                  </Btn>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 13, color: RL.muted, marginTop: 20 }}>Secure checkout by Razorpay · Prices in INR · 30 days of access per purchase</p>
    </div>
  );
}
