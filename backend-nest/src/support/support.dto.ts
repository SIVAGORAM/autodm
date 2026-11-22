import { z } from 'zod';

export const createSupportRequestSchema = z.object({
  type: z.enum(['SUPPORT', 'FEEDBACK']),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(5_000),
  rating: z.number().int().min(1).max(5).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'SUPPORT' && value.rating !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['rating'], message: 'Ratings are only used for feedback.' });
  }
});

export const supportRequestStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']);
export const supportMessageSchema = z.object({ body: z.string().trim().min(1).max(5_000) });

export const supportRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  status: supportRequestStatusSchema.optional(),
});

export type CreateSupportRequest = z.infer<typeof createSupportRequestSchema>;
export type SupportMessageInput = z.infer<typeof supportMessageSchema>;
