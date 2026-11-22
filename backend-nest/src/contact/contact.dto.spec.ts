import { contactEnquiriesQuerySchema, publicContactEnquirySchema } from './contact.dto';

describe('contact DTOs', () => {
  it('normalizes public enquiry email and enforces bounded input lengths', () => {
    const result = publicContactEnquirySchema.parse({
      name: 'Creator', email: '  CREATOR@EXAMPLE.TEST ', subject: 'Partnership',
      message: 'I would like to discuss a partnership.', website: '',
    });
    expect(result.email).toBe('creator@example.test');
    expect(() => publicContactEnquirySchema.parse({ name: '', email: 'x', subject: 'a', message: 'short' })).toThrow();
    expect(() => publicContactEnquirySchema.parse({ name: 'Creator', email: 'person@example.test', subject: 'x'.repeat(121), message: 'This is a valid message.' })).toThrow();
  });

  it('bounds enquiry search pages and accepts only known workflow filters', () => {
    expect(contactEnquiriesQuerySchema.parse({ page: '2', pageSize: '25', status: 'NEW' }))
      .toMatchObject({ page: 2, pageSize: 25, status: 'NEW' });
    expect(() => contactEnquiriesQuerySchema.parse({ pageSize: 1000 })).toThrow();
    expect(() => contactEnquiriesQuerySchema.parse({ assigned: 'ANYONE' })).toThrow();
  });
});
