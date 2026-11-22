import { createSupportRequestSchema, supportMessageSchema, supportRequestsQuerySchema, supportRequestStatusSchema } from './support.dto';

describe('support request validation', () => {
  it('trims and accepts bounded support messages', () => {
    expect(createSupportRequestSchema.parse({
      type: 'SUPPORT', subject: '  Login help  ', message: '  I cannot verify my email.  ',
    })).toEqual({ type: 'SUPPORT', subject: 'Login help', message: 'I cannot verify my email.' });
  });

  it('accepts optional feedback ratings but rejects ratings on support requests', () => {
    expect(createSupportRequestSchema.safeParse({
      type: 'FEEDBACK', subject: 'Product feedback', message: 'I like the activity log.', rating: 5,
    }).success).toBe(true);
    expect(createSupportRequestSchema.safeParse({
      type: 'SUPPORT', subject: 'Login help', message: 'I cannot verify my email.', rating: 5,
    }).success).toBe(false);
    expect(createSupportRequestSchema.safeParse({
      type: 'FEEDBACK', subject: 'Product feedback', message: 'I like the activity log.', rating: 6,
    }).success).toBe(false);
  });

  it('rejects short/oversized messages and validates pagination/status filters', () => {
    expect(createSupportRequestSchema.safeParse({ type: 'SUPPORT', subject: 'ok', message: 'short' }).success).toBe(false);
    expect(createSupportRequestSchema.safeParse({ type: 'SUPPORT', subject: 'Login help', message: 'x'.repeat(5_001) }).success).toBe(false);
    expect(supportRequestsQuerySchema.parse({ page: '2', status: 'OPEN' })).toEqual({ page: 2, status: 'OPEN' });
    expect(supportRequestStatusSchema.safeParse('CLOSED').success).toBe(false);
    expect(supportMessageSchema.parse({ body: '  Additional details  ' })).toEqual({ body: 'Additional details' });
    expect(supportMessageSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(supportMessageSchema.safeParse({ body: 'x'.repeat(5_001) }).success).toBe(false);
  });
});
