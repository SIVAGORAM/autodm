import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  plan: z.string().trim().min(1).max(32),
}).strict();

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1).max(128),
  razorpay_payment_id: z.string().min(1).max(128),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();
