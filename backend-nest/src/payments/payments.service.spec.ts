import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PaymentsService } from './payments.service';

const SECRET = 'test-razorpay-secret';
const USER_ID = 'user-1';
const ORDER_ID = 'order-1';
const PAYMENT_ID = 'pay-1';

function signature() {
  return crypto.createHmac('sha256', SECRET).update(`${ORDER_ID}|${PAYMENT_ID}`).digest('hex');
}

function setup() {
  const user: { id: string; plan: string; planExpiresAt: Date | null; trialEndsAt: Date | null; dmCount: number; dmCountResetAt: Date | null } = {
    id: USER_ID, plan: 'FREE', planExpiresAt: null, trialEndsAt: null,
    dmCount: 0, dmCountResetAt: null,
  };
  let appliedPayment: any = null;
  const findPayment = jest.fn(async ({ where }: any) => {
    if (where.orderId) return appliedPayment?.orderId === where.orderId ? appliedPayment : null;
    if (where.paymentId) return appliedPayment?.paymentId === where.paymentId ? appliedPayment : null;
    return null;
  });
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({}),
    },
    igAccount: { count: jest.fn().mockResolvedValue(0) },
    payment: { findUnique: findPayment },
    $transaction: jest.fn(async (fn) => fn({
      payment: {
        findUnique: findPayment,
        create: jest.fn(async ({ data }) => { appliedPayment = data; return data; }),
      },
      user: {
        findUnique: jest.fn(async () => ({ planExpiresAt: user.planExpiresAt })),
        update: jest.fn(async ({ data }) => Object.assign(user, data)),
      },
    })),
  };
  const config: any = { get: jest.fn((key: string) => key === 'RAZORPAY_KEY_ID' ? 'rzp_test_id' : key === 'RAZORPAY_KEY_SECRET' ? SECRET : key === 'RAZORPAY_WEBHOOK_SECRET' ? 'test-webhook-secret' : undefined) };
  const dashboardEvents = { publish: jest.fn().mockResolvedValue(undefined) };
  const service = new PaymentsService(config as ConfigService, prisma, dashboardEvents as any);
  const rzp: any = {
    orders: { fetch: jest.fn().mockResolvedValue({
      status: 'paid', notes: { userId: USER_ID, plan: 'CREATOR' }, amount: 29900, currency: 'INR',
    }) },
    payments: { fetch: jest.fn().mockResolvedValue({
      order_id: ORDER_ID, status: 'captured', amount: 29900, currency: 'INR',
    }) },
  };
  (service as any).rzp = rzp;
  return { service, prisma, rzp, user, dashboardEvents };
}

describe('PaymentsService.subscription', () => {
  it('counts active Instagram connections against the plan cap', async () => {
    const { service, prisma } = setup();
    prisma.igAccount.count.mockResolvedValue(2);

    const result = await service.subscription(USER_ID);

    expect(prisma.igAccount.count).toHaveBeenCalledWith({ where: { userId: USER_ID, isActive: true } });
    expect(result.usage.accountsUsed).toBe(2);
  });
});

describe('PaymentsService.createOrder', () => {
  it('does not create production orders until legal policies are approved', async () => {
    const { service, rzp } = setup();
    rzp.orders.create = jest.fn();
    (service as any).config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'LEGAL_POLICY_STATUS') return fallback ?? 'DRAFT';
      return undefined;
    });

    await expect(service.createOrder(USER_ID, 'CREATOR')).rejects.toThrow(ServiceUnavailableException);
    expect(rzp.orders.create).not.toHaveBeenCalled();
  });

  it('allows mocked production order creation after policies are approved', async () => {
    const { service, rzp } = setup();
    rzp.orders.create = jest.fn().mockResolvedValue({ id: ORDER_ID, amount: 29900, currency: 'INR' });
    (service as any).config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'LEGAL_POLICY_STATUS') return 'APPROVED';
      if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_id';
      return fallback;
    });

    const result = await service.createOrder(USER_ID, 'CREATOR');

    expect(result.orderId).toBe(ORDER_ID);
    expect(rzp.orders.create).toHaveBeenCalledTimes(1);
  });
});

describe('PaymentsService.verify', () => {
  it('fails closed when Razorpay says the order is not paid', async () => {
    const { service, prisma, rzp } = setup();
    rzp.orders.fetch.mockResolvedValue({ status: 'created', notes: { userId: USER_ID, plan: 'CREATOR' }, amount: 29900, currency: 'INR' });

    await expect(service.verify(USER_ID, ORDER_ID, PAYMENT_ID, signature()))
      .rejects.toThrow(BadRequestException);

    expect(rzp.payments.fetch).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records a valid captured payment and grants the plan once', async () => {
    const { service, prisma, dashboardEvents } = setup();

    const result = await service.verify(USER_ID, ORDER_ID, PAYMENT_ID, signature());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.tier).toBe('CREATOR');
    expect(result.isPaid).toBe(true);
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(dashboardEvents.publish).toHaveBeenCalledWith(USER_ID, 'billing');
  });

  it('retries a serialization conflict and extends from the latest committed expiry', async () => {
    const { service, prisma, user } = setup();
    const firstExpiry = new Date(Date.now() + 5 * 86400000);
    const concurrentPurchaseExpiry = new Date(firstExpiry.getTime() + 30 * 86400000);
    user.planExpiresAt = firstExpiry;
    const commitTransaction = prisma.$transaction.getMockImplementation();
    let conflictOnce = true;
    prisma.$transaction.mockImplementation(async (callback: any, options: any) => {
      if (conflictOnce) {
        conflictOnce = false;
        // Model another order winning the write and advancing the expiry.
        user.planExpiresAt = concurrentPurchaseExpiry;
        throw { code: 'P2034' };
      }
      return commitTransaction(callback, options);
    });

    await service.verify(USER_ID, ORDER_ID, PAYMENT_ID, signature());

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(user.planExpiresAt?.getTime()).toBe(concurrentPurchaseExpiry.getTime() + 30 * 86400000);
  });

  it('records a captured payment without restoring entitlements when deletion has started', async () => {
    const { service, prisma, user } = setup();
    const paymentCreate = jest.fn().mockImplementation(async ({ data }) => data);
    const userUpdate = jest.fn();
    prisma.$transaction.mockImplementationOnce(async (callback: any) => callback({
      payment: { findUnique: jest.fn().mockResolvedValue(null), create: paymentCreate },
      user: {
        findUnique: jest.fn().mockResolvedValue({ planExpiresAt: null, deletionRequestedAt: new Date() }),
        update: userUpdate,
      },
    }));

    const result = await service.verify(USER_ID, ORDER_ID, PAYMENT_ID, signature());

    expect(result.paymentApplied).toBe(false);
    expect(paymentCreate).toHaveBeenCalledWith({
      data: { orderId: ORDER_ID, paymentId: PAYMENT_ID, userId: null, plan: 'CREATOR', amount: 29900, currency: 'INR' },
    });
    expect(userUpdate).not.toHaveBeenCalled();
    expect(user.plan).toBe('FREE');
  });

  it('does not extend access when the same order is verified again', async () => {
    const { service, prisma } = setup();
    prisma.payment.findUnique.mockResolvedValue({ orderId: ORDER_ID, paymentId: PAYMENT_ID, userId: USER_ID });

    await service.verify(USER_ID, ORDER_ID, PAYMENT_ID, signature());

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('treats a same-payment commit observed inside the transaction as an idempotent success', async () => {
    const { service, prisma, user } = setup();
    const alreadyApplied = { orderId: ORDER_ID, paymentId: PAYMENT_ID, userId: USER_ID };
    const committedExpiry = new Date(Date.now() + 30 * 86400000);
    user.plan = 'CREATOR';
    user.planExpiresAt = committedExpiry;
    prisma.$transaction.mockImplementationOnce(async (callback: any) => callback({
      payment: {
        findUnique: jest.fn().mockResolvedValue(alreadyApplied),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }));

    const result = await service.verify(USER_ID, ORDER_ID, PAYMENT_ID, signature());

    expect(result.isPaid).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(user.plan).toBe('CREATOR');
    expect(user.planExpiresAt).toBe(committedExpiry);
  });
});

describe('PaymentsService.processWebhook', () => {
  const webhookSecret = 'test-webhook-secret';
  function signedEvent(event: string, payment: Record<string, unknown> = {}) {
    const body = Buffer.from(JSON.stringify({ event, payload: { payment: { entity: payment } } }));
    const sig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    return { body, sig };
  }

  it('rejects webhook requests with an invalid signature', async () => {
    const { service, prisma } = setup();
    const { body } = signedEvent('payment.captured', { id: PAYMENT_ID, order_id: ORDER_ID });

    await expect(service.processWebhook(body, '0'.repeat(64))).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ignores authenticated events unrelated to captured payments', async () => {
    const { service, prisma } = setup();
    const { body, sig } = signedEvent('payment.failed', { id: PAYMENT_ID, order_id: ORDER_ID });

    await expect(service.processWebhook(body, sig)).resolves.toEqual({ received: true, applied: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('applies a captured payment from the signed event exactly once', async () => {
    const { service, prisma, rzp, dashboardEvents } = setup();
    const { body, sig } = signedEvent('payment.captured', { id: PAYMENT_ID, order_id: ORDER_ID });

    await expect(service.processWebhook(body, sig)).resolves.toEqual({ received: true, applied: true });
    await expect(service.processWebhook(body, sig)).resolves.toEqual({ received: true, applied: false });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(rzp.orders.fetch).toHaveBeenCalledTimes(1);
    expect(dashboardEvents.publish).toHaveBeenCalledTimes(1);
    expect(dashboardEvents.publish).toHaveBeenCalledWith(USER_ID, 'billing');
  });

  it('acknowledges a captured payment without granting access to a deleting account', async () => {
    const { service, prisma } = setup();
    const paymentCreate = jest.fn().mockImplementation(async ({ data }) => data);
    const userUpdate = jest.fn();
    prisma.$transaction.mockImplementationOnce(async (callback: any) => callback({
      payment: { findUnique: jest.fn().mockResolvedValue(null), create: paymentCreate },
      user: {
        findUnique: jest.fn().mockResolvedValue({ planExpiresAt: null, deletionRequestedAt: new Date() }),
        update: userUpdate,
      },
    }));
    const body = Buffer.from(JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: PAYMENT_ID, order_id: ORDER_ID } } },
    }));
    const sig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

    await expect(service.processWebhook(body, sig)).resolves.toEqual({ received: true, applied: false });
    expect(paymentCreate).toHaveBeenCalledWith({
      data: { orderId: ORDER_ID, paymentId: PAYMENT_ID, userId: null, plan: 'CREATOR', amount: 29900, currency: 'INR' },
    });
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
