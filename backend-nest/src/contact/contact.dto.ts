import { z } from 'zod';

export const publicContactEnquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(5_000),
  website: z.string().max(500).optional(),
});

export const contactEnquiriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  status: z.enum(['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'SPAM']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  search: z.string().trim().max(100).optional(),
  assigned: z.enum(['MINE', 'UNASSIGNED']).optional(),
});

export const contactEnquiryStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED', 'SPAM']),
  reason: z.string().trim().min(10).max(500),
});

export const contactEnquiryPrioritySchema = z.object({
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  reason: z.string().trim().min(10).max(500),
});

export const contactEnquiryMessageSchema = z.object({ body: z.string().trim().min(1).max(5_000) });

export type PublicContactEnquiry = z.infer<typeof publicContactEnquirySchema>;
export type ContactEnquiriesQuery = z.infer<typeof contactEnquiriesQuerySchema>;
