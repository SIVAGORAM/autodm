import { z } from 'zod';

export const publicProfileReportReasonSchema = z.enum([
  'IMPERSONATION', 'SCAM', 'INAPPROPRIATE', 'SPAM', 'COPYRIGHT', 'OTHER',
]);

export const createPublicProfileReportSchema = z.object({
  reason: publicProfileReportReasonSchema,
  details: z.string().trim().max(1000).optional().transform((value) => value || undefined),
});

export const publicProfileReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  status: z.enum(['OPEN', 'IN_REVIEW', 'ACTIONED', 'DISMISSED']).optional(),
});

export const reviewPublicProfileReportSchema = z.object({
  status: z.enum(['IN_REVIEW', 'ACTIONED', 'DISMISSED']),
  moderationNote: z.string().trim().min(5).max(1000),
});

export const restorePublicProfileSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

export type CreatePublicProfileReport = z.infer<typeof createPublicProfileReportSchema>;
export type ReviewPublicProfileReport = z.infer<typeof reviewPublicProfileReportSchema>;
