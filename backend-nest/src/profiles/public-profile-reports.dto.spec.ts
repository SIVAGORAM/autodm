import { createPublicProfileReportSchema, publicProfileReportsQuerySchema, restorePublicProfileSchema, reviewPublicProfileReportSchema } from './public-profile-reports.dto';

describe('public profile report schemas', () => {
  it('accepts a report with bounded optional context', () => {
    expect(createPublicProfileReportSchema.parse({ reason: 'SCAM', details: 'This profile links to a fake checkout.' })).toEqual({
      reason: 'SCAM', details: 'This profile links to a fake checkout.',
    });
    expect(createPublicProfileReportSchema.parse({ reason: 'SPAM', details: '  ' })).toEqual({ reason: 'SPAM', details: undefined });
  });

  it('rejects unknown reasons and details that exceed the storage bound', () => {
    expect(createPublicProfileReportSchema.safeParse({ reason: 'BAD_REASON' }).success).toBe(false);
    expect(createPublicProfileReportSchema.safeParse({ reason: 'OTHER', details: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('limits admin page size inputs and prevents arbitrary moderation states', () => {
    expect(publicProfileReportsQuerySchema.parse({ page: '2', status: 'OPEN' })).toMatchObject({ page: 2, status: 'OPEN' });
    expect(publicProfileReportsQuerySchema.safeParse({ status: 'DELETED' }).success).toBe(false);
    expect(reviewPublicProfileReportSchema.safeParse({ status: 'OPEN', moderationNote: 'test note' }).success).toBe(false);
    expect(reviewPublicProfileReportSchema.safeParse({ status: 'ACTIONED', moderationNote: '  no  ' }).success).toBe(false);
    expect(restorePublicProfileSchema.safeParse({ reason: 'False positive confirmed' }).success).toBe(true);
    expect(restorePublicProfileSchema.safeParse({ reason: 'short' }).success).toBe(false);
  });
});
