import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

const PRO_PRICE_PAISE = 49900; // ₹499
const PRO_DAYS = 30;

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);
  private rzp: any = null;
  constructor(private config: ConfigService, private prisma: PrismaService) {
    const key_id = this.config.get<string>('RAZORPAY_KEY_ID');
    const key_secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (key_id && key_secret) this.rzp = new Razorpay({ key_id, key_secret });
  }

  plans() {
    return [
      { id: 'free', name: 'Free', pricePaise: 0, price: '₹0', features: ['Auto-DM on posts & Reels', '1 keyword per automation', 'Live status + delivery log', 'Unlimited contacts', '1 Instagram account'] },
      { id: 'pro', name: 'Pro', pricePaise: PRO_PRICE_PAISE, price: '₹499', per: '/mo', features: ['Everything in Free', 'Unlimited keywords', 'Stories, Lives & incoming DMs', 'Follow-ups & ask-to-follow', 'Break alerts & auto-reconnect', 'Up to 5 Instagram accounts'] },
    ];
  }

  async subscription(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpiresAt: true } });
    const active = u?.plan === 'PAID' && (!u.planExpiresAt || u.planExpiresAt > new Date());
    return { plan: active ? 'pro' : 'free', planExpiresAt: u?.planExpiresAt ?? null, active: !!active };
  }

  async createOrder(userId: string) {
    if (!this.rzp) throw new BadRequestException('Payments are not set up yet. Please contact support.');
    try {
      const order = await this.rzp.orders.create({
        amount: PRO_PRICE_PAISE, currency: 'INR',
        receipt: `pro_${userId.slice(0, 8)}_${Date.now()}`,
        notes: { userId, plan: 'pro' },
      });
      return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: this.config.get<string>('RAZORPAY_KEY_ID') };
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
    const ok = expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!ok) throw new BadRequestException('Payment verification failed.');
    const planExpiresAt = new Date(Date.now() + PRO_DAYS * 86400000);
    await this.prisma.user.update({ where: { id: userId }, data: { plan: 'PAID', planExpiresAt } });
    return this.subscription(userId);
  }

  async cancel(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { plan: 'FREE', planExpiresAt: null } });
    return { success: true };
  }
}
