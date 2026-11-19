// src/controllers/payment.controller.ts
import { Request, Response, NextFunction } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { env } from '../configs/env';
import { AppError } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

export const paymentController = {
  async getPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      });
      res.json({ success: true, data: { plans } });
    } catch (err) { next(err); }
  },

  async createSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const { planId } = req.body;

      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) throw new AppError('Plan not found', 404, 'NOT_FOUND');

      // Check for existing active subscription
      const existing = await prisma.subscription.findUnique({ where: { userId: req.user!.userId } });
      if (existing?.status === 'ACTIVE') {
        throw new AppError('You already have an active subscription', 409, 'ALREADY_SUBSCRIBED');
      }

      const subscription = await razorpay.subscriptions.create({
        plan_id: plan.razorpayPlanId,
        customer_notify: 1,
        total_count: plan.interval === 'yearly' ? 1 : 12,
        notes: { userId: req.user!.userId, planId },
      });

      await prisma.subscription.upsert({
        where: { userId: req.user!.userId },
        update: { planId, razorpaySubId: subscription.id, status: 'CREATED' },
        create: { userId: req.user!.userId, planId, razorpaySubId: subscription.id, status: 'CREATED' },
      });

      res.json({
        success: true,
        data: {
          subscriptionId: subscription.id,
          keyId: env.RAZORPAY_KEY_ID,
        },
      });
    } catch (err) { next(err); }
  },

  async handleWebhook(req: Request, res: Response): Promise<void> {
    // Always respond 200 immediately
    res.status(200).json({ status: 'ok' });

    try {
      const rawBody = req.body as Buffer;
      const signature = req.headers['x-razorpay-signature'] as string;
      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn('Invalid Razorpay webhook signature');
        return;
      }

      const event = JSON.parse(rawBody.toString());
      const eventId = event.id;

      // Idempotency - skip already-processed events
      const existing = await prisma.razorpayEvent.findUnique({ where: { eventId } });
      if (existing) return;

      await prisma.razorpayEvent.create({
        data: { eventId, eventType: event.event, payload: event },
      });

      const payload = event.payload?.subscription?.entity;

      switch (event.event) {
        case 'subscription.activated': {
          await prisma.subscription.update({
            where: { razorpaySubId: payload.id },
            data: {
              status: 'ACTIVE',
              currentPeriodStart: new Date(payload.current_start * 1000),
              currentPeriodEnd: new Date(payload.current_end * 1000),
            },
          });
          break;
        }
        case 'subscription.halted':
        case 'subscription.cancelled': {
          await prisma.subscription.update({
            where: { razorpaySubId: payload.id },
            data: { status: event.event === 'subscription.halted' ? 'HALTED' : 'CANCELLED' },
          });
          break;
        }
        case 'payment.captured': {
          const paymentEntity = event.payload?.payment?.entity;
          if (paymentEntity) {
            const sub = await prisma.subscription.findFirst({
              where: { razorpaySubId: paymentEntity.subscription_id },
            });
            if (sub) {
              await prisma.payment.create({
                data: {
                  userId: sub.userId,
                  razorpayPaymentId: paymentEntity.id,
                  razorpayOrderId: paymentEntity.order_id,
                  amount: paymentEntity.amount,
                  currency: paymentEntity.currency,
                  status: 'CAPTURED',
                },
              });
            }
          }
          break;
        }
      }

      logger.info(`Razorpay event processed: ${event.event}`);
    } catch (error) {
      logger.error('Razorpay webhook error:', error);
    }
  },

  async getMySubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: req.user!.userId },
        include: { plan: true },
      });
      res.json({ success: true, data: { subscription } });
    } catch (err) { next(err); }
  },

  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: req.user!.userId },
      });
      if (!subscription) throw new AppError('No subscription found', 404, 'NOT_FOUND');

      await razorpay.subscriptions.cancel(subscription.razorpaySubId);
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELLED' },
      });

      res.json({ success: true, message: 'Subscription cancelled' });
    } catch (err) { next(err); }
  },
};
