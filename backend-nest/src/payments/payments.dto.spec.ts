import { createPaymentOrderSchema, verifyPaymentSchema } from './payments.dto';

describe('payment request schemas', () => {
  it('normalizes the selected plan name', () => {
    expect(createPaymentOrderSchema.parse({ plan: ' CREATOR ' })).toEqual({ plan: 'CREATOR' });
  });

  it.each([null, { plan: 1 }, { plan: 'x'.repeat(33) }, { plan: 'PRO', amount: 100 }])(
    'rejects malformed checkout-order requests',
    (input) => expect(() => createPaymentOrderSchema.parse(input)).toThrow(),
  );

  it('accepts the expected payment verification fields', () => {
    expect(verifyPaymentSchema.parse({
      razorpay_order_id: 'order_test',
      razorpay_payment_id: 'pay_test',
      razorpay_signature: 'a'.repeat(64),
    })).toMatchObject({ razorpay_order_id: 'order_test', razorpay_payment_id: 'pay_test' });
  });

  it.each([
    null,
    { razorpay_order_id: 1, razorpay_payment_id: 'pay_test', razorpay_signature: 'a'.repeat(64) },
    { razorpay_order_id: 'order_test', razorpay_payment_id: 'pay_test', razorpay_signature: 'not-a-signature' },
    { razorpay_order_id: 'order_test', razorpay_payment_id: 'pay_test', razorpay_signature: 'a'.repeat(64), plan: 'PRO' },
  ])('rejects malformed payment-verification requests', (input) => {
    expect(() => verifyPaymentSchema.parse(input)).toThrow();
  });
});
