import { Injectable, BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PLANS, TIER_ORDER, PAID_TIERS, PLAN_DAYS, Tier, planDef } from '../common/plan.config';
import { effectivePlan, paidTier, trialActive } from '../common/plan.util';
import { safeErrorLabel } from '../common/safe-error-label';
import { DashboardEventsService } from '../queue/dashboard-events.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);
  private rzp: any = null;
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private readonly dashboardEvents: DashboardEventsService,
  ) {
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
        per: p.pricePaise > 0 ? '/30 days' : undefined,
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

    const accountsUsed = await this.prisma.igAccount.count({ where: { userId, isActive: true } });

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
    if (this.config.get('NODE_ENV') === 'production' && this.config.get('LEGAL_POLICY_STATUS', 'DRAFT') !== 'APPROVED') {
      throw new ServiceUnavailableException('Checkout is temporarily unavailable while the legal policies are being finalized.');
    }
    if (!this.rzp) throw new BadRequestException('Payments are not set up yet. Please contact support.');
    const tier = (planId || '').toUpperCase() as Tier;
    if (!PAID_TIERS.includes(tier)) throw new BadRequestException('Choose a valid plan to upgrade to.');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true } });
    const activeTier = paidTier(user);
    if (activeTier && TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(activeTier)) {
      throw new BadRequestException('Choose your current plan to renew it, or select a higher plan.');
    }
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
      const status = Number.isInteger(err?.statusCode) ? err.statusCode : 'unknown';
      const rawCode = err?.error?.code ?? err?.code;
      const code = typeof rawCode === 'number' || (typeof rawCode === 'string' && /^[a-z0-9_.-]{1,40}$/i.test(rawCode))
        ? String(rawCode)
        : 'unknown';
      this.log.error(`Razorpay order creation failed status=${status} code=${code}`);
      throw new BadRequestException('Could not start checkout. Please try again or contact support.');
    }
  }

  async verify(userId: string, orderId: string, paymentId: string, signature: string) {
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!secret) throw new BadRequestException('Payments are not configured yet.');
    if (!orderId || !paymentId || !signature) throw new BadRequestException('Missing payment fields.');

    if (!/^[a-f0-9]{64}$/i.test(signature)) throw new BadRequestException('Payment verification failed.');
    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    const ok =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) throw new BadRequestException('Payment verification failed.');

    return this.applyCapturedPayment(userId, orderId, paymentId);
  }

  /**
   * Process Razorpay's signed payment.captured event. The event signature
   * authenticates the raw payload; provider records are fetched again before
   * entitlements are granted, so a partial or stale webhook cannot grant a plan.
   */
  async processWebhook(rawBody: Buffer, signature: string | undefined) {
    const webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret || !rawBody?.length || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      throw new BadRequestException('Invalid payment webhook signature.');
    }
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    const expectedBytes = Buffer.from(expected, 'hex');
    const suppliedBytes = Buffer.from(signature, 'hex');
    if (expectedBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(expectedBytes, suppliedBytes)) {
      throw new BadRequestException('Invalid payment webhook signature.');
    }

    let event: any;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid payment webhook payload.');
    }
    if (event?.event !== 'payment.captured') return { received: true, applied: false };
    const payment = event?.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;
    if (typeof orderId !== 'string' || !orderId || typeof paymentId !== 'string' || !paymentId) {
      throw new BadRequestException('Payment webhook is missing order details.');
    }

    const applied = await this.prisma.payment.findUnique({ where: { orderId } });
    if (applied) {
      if (applied.paymentId !== paymentId) throw new BadRequestException('Order has already been applied with another payment.');
      return { received: true, applied: false };
    }

    const order = await this.fetchPaidOrder(orderId, paymentId);
    const userId = order.userId;
    const entitlementApplied = await this.applyVerifiedPayment(userId, orderId, paymentId, order.tier, order.amount, order.currency);
    if (entitlementApplied) void this.dashboardEvents.publish(userId, 'billing');
    return { received: true, applied: entitlementApplied };
  }

  private async applyCapturedPayment(userId: string, orderId: string, paymentId: string) {
    const order = await this.fetchPaidOrder(orderId, paymentId);
    if (order.userId !== userId) throw new BadRequestException('Order does not belong to this account.');
    const paymentApplied = await this.applyVerifiedPayment(userId, orderId, paymentId, order.tier, order.amount, order.currency);
    if (paymentApplied) void this.dashboardEvents.publish(userId, 'billing');
    return { ...await this.subscription(userId), paymentApplied };
  }

  private async fetchPaidOrder(orderId: string, paymentId: string) {
    // Read the purchased tier from Razorpay order NOTES — never from the
    // client or webhook payload — so the plan granted matches what was charged.
    let tier: Tier;
    let amount: number;
    let currency: string;
    let userId: string;
    try {
      const order = await this.rzp.orders.fetch(orderId);
      const notedUser = order?.notes?.userId;
      if (typeof notedUser !== 'string' || !notedUser) throw new BadRequestException('Order has no valid account.');
      userId = notedUser;
      const notedPlan = (order?.notes?.plan || '').toUpperCase() as Tier;
      if (!PAID_TIERS.includes(notedPlan)) throw new BadRequestException('Order has no valid plan.');
      tier = notedPlan;
      amount = Number(order.amount);
      currency = String(order.currency);
      if (order.status !== 'paid' || amount !== PLANS[tier].pricePaise || currency !== 'INR') {
        throw new BadRequestException('Order is unpaid or its amount does not match the plan.');
      }
      const payment = await this.rzp.payments.fetch(paymentId);
      if (payment.order_id !== orderId || payment.status !== 'captured' || Number(payment.amount) !== amount || payment.currency !== currency) {
        throw new BadRequestException('Payment is not captured for this order.');
      }
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      this.log.error(`Razorpay verification lookup failed (${safeErrorLabel(e)})`);
      throw new BadRequestException('Payment could not be verified. Please try again or contact support.');
    }

    return { userId, tier, amount, currency };
  }

  private async applyVerifiedPayment(userId: string, orderId: string, paymentId: string, tier: Tier, amount: number, currency: string) {
    const alreadyApplied = await this.prisma.payment.findUnique({ where: { orderId } });
    if (alreadyApplied) {
      if (alreadyApplied.userId !== userId || alreadyApplied.paymentId !== paymentId) {
        throw new BadRequestException('Payment has already been applied to another account.');
      }
      return true;
    }
    const now = new Date();
    const maxSerializationRetries = 3;
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const existingOrder = await tx.payment.findUnique({ where: { orderId } });
          if (existingOrder) {
            if (existingOrder.paymentId === paymentId) {
              if (existingOrder.userId === userId) return true;
              if (existingOrder.userId === null) return false;
            }
            throw new BadRequestException('Order has already been applied with another payment.');
          }
          const existing = await tx.payment.findUnique({ where: { paymentId } });
          if (existing) throw new BadRequestException('Payment has already been applied.');
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { planExpiresAt: true, deletionRequestedAt: true },
          });
          if (!user || user.deletionRequestedAt) {
            // Preserve the verified payment receipt for reconciliation while
            // ensuring an account being deleted (or already deleted) cannot
            // regain product access from a delayed provider callback.
            await tx.payment.create({ data: { orderId, paymentId, userId: null, plan: tier, amount, currency } });
            return false;
          }
          const start = user.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;
          const planExpiresAt = new Date(start.getTime() + PLAN_DAYS * 86400000);
          await tx.payment.create({ data: { orderId, paymentId, userId, plan: tier, amount, currency } });
          await tx.user.update({ where: { id: userId }, data: { plan: tier, planExpiresAt } });
          return true;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (e: any) {
        // Serializable isolation prevents two different orders from reading
        // the same expiry and losing one paid extension. Retry write conflicts
        // so each successful transaction observes the latest expiry.
        if (e?.code === 'P2034' && attempt < maxSerializationRetries) {
          await new Promise((resolve) => setTimeout(resolve, 25 * (2 ** attempt)));
          continue;
        }
        // Two browser callbacks can race. A duplicate callback is successful if
        // the first transaction already applied this exact order to this user.
        if (e?.code === 'P2002') {
          const applied = await this.prisma.payment.findUnique({ where: { orderId } });
          if (applied?.paymentId === paymentId && (applied.userId === userId || applied.userId === null)) {
            return applied.userId === userId;
          }
          throw new BadRequestException('Payment has already been applied.');
        }
        throw e;
      }
    }
  }

}
