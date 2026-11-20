import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PLANS, TIER_ORDER, PAID_TIERS, PLAN_DAYS, Tier, planDef } from '../common/plan.config';
import { effectivePlan, paidTier, trialActive } from '../common/plan.util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);
  private rzp: any = null;
  constructor(private config: ConfigService, private prisma: PrismaService) {
    const key_id = this.config.get<string>('RAZORPAY_KEY_ID');
    const key_secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (key_id && key_secret) this.rzp = new Razorpay({ key_id, key_secret });
  }

  // The public plan catalogue, straight from the single source of truth.
  plans() {
    return TIER_ORDER.map((t) => {
      const p = PLANS[t];
      return {
        id: p.id.toLowerCase(),
        tier: p.id,
        name: p.name,
        tagline: p.tagline,
        pricePaise: p.pricePaise,
        price: p.priceLabel,
        per: p.pricePaise > 0 ? '/mo' : undefined,
        accountCap: p.accountCap,
        dmQuota: p.dmQuota,
        features: p.features,
        highlights: p.highlights,
      };
    });
  }

  // Live subscription + usage — everything the UI needs to show limits in real time.
  async subscription(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true, trialEndsAt: true, dmCount: true, dmCountResetAt: true },
    });
    const tier: Tier = effectivePlan(u);
    const def = planDef(tier);
    const paid = paidTier(u);
    const trialing = trialActive(u);

    // DM usage: the stored counter only counts within the live window; a lapsed
    // window reads as 0 (the webhook resets it lazily on the next send).
    const now = Date.now();
    const windowLive = !!(u?.dmCountResetAt && u.dmCountResetAt.getTime() > now);
    const dmUsed = windowLive ? u!.dmCount : 0;

    const accountsUsed = await this.prisma.igAccount.count({ where: { userId } });

    return {
      plan: tier.toLowerCase(),         // 'free' | 'creator' | 'pro' | 'agency'
      tier,                             // 'FREE' | 'CREATOR' | 'PRO' | 'AGENCY'
      name: def.name,
      active: tier !== 'FREE',
      isPaid: paid !== null,            // true only for a real paid subscription
      paidTier: paid,                   // the tier they actually bought, or null
      trial: { active: trialing, endsAt: u?.trialEndsAt ?? null },
      planExpiresAt: u?.planExpiresAt ?? null,
      limits: { accountCap: def.accountCap, dmQuota: def.dmQuota },
      usage: { accountsUsed, dmUsed, dmResetAt: u?.dmCountResetAt ?? null },
      features: def.features,
    };
  }

  async createOrder(userId: string, planId?: string) {
    if (!this.rzp) throw new BadRequestException('Payments are not set up yet. Please contact support.');
    const tier = (planId || '').toUpperCase() as Tier;
    if (!PAID_TIERS.includes(tier)) throw new BadRequestException('Choose a valid plan to upgrade to.');
    const def = PLANS[tier];
    try {
      const order = await this.rzp.orders.create({
        amount: def.pricePaise,
        currency: 'INR',
        receipt: `${tier.toLowerCase()}_${userId.slice(0, 8)}_${Date.now()}`,
        notes: { userId, plan: tier },
      });
      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        plan: tier,
        planName: def.name,
        keyId: this.config.get<string>('RAZORPAY_KEY_ID'),
      };
    } catch (err: any) {
      const detail = err?.error?.description || err?.message || JSON.stringify(err);
      this.log.error(`Razorpay order creation failed: ${detail}`);
      throw new BadRequestException(`Couldn't start checkout: ${detail}`);
    }
  }

  async verify(userId: string, orderId: string, paymentId: string, signature: string) {
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!secret) throw new BadRequestException('Payments are not configured yet.');
    if (!orderId || !paymentId || !signature) throw new BadRequestException('Missing payment fields.');

    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    const ok =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) throw new BadRequestException('Payment verification failed.');

    // Read the purchased tier from the Razorpay order NOTES — never from the
    // client — so the plan granted matches exactly what was charged.
    let tier: Tier = 'PRO';
    try {
      const order = await this.rzp.orders.fetch(orderId);
      const notedUser = order?.notes?.userId;
      const notedPlan = (order?.notes?.plan || '').toUpperCase() as Tier;
      if (notedUser && notedUser !== userId) throw new BadRequestException('Order does not belong to this account.');
      if (PAID_TIERS.includes(notedPlan)) tier = notedPlan;
    } catch (e: any) {
      this.log.warn(`Could not fetch order notes for ${orderId}: ${e?.message ?? e}`);
    }

    const planExpiresAt = new Date(Date.now() + PLAN_DAYS * 86400000);
    await this.prisma.user.update({ where: { id: userId }, data: { plan: tier as any, planExpiresAt } });
    return this.subscription(userId);
  }

  async cancel(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { plan: 'FREE' as any, planExpiresAt: null } });
    return this.subscription(userId);
  }
}
