import { z } from 'zod';
import { ADMIN_PERMISSIONS } from '../common/admin-permissions';

export const adminRoleSchema = z.enum(['ADMIN', 'SUPER_ADMIN', 'INFLUENCER']);
export const updateAdminRoleSchema = z.object({
  role: adminRoleSchema,
  reason: z.string().trim().min(10).max(500),
});
export const addAdminSchema = z.object({
  email: z.string().trim().email().max(254),
  reason: z.string().trim().min(10).max(500),
});
export const adminPermissionsSchema = z.object({
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).max(ADMIN_PERMISSIONS.length),
  reason: z.string().trim().min(10).max(500),
}).refine((input) => new Set(input.permissions).size === input.permissions.length, {
  path: ['permissions'], message: 'Permissions must not contain duplicates.',
});
export const createAdminInvitationSchema = z.object({
  email: z.string().trim().email().max(254),
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).max(ADMIN_PERMISSIONS.length).default([]),
  reason: z.string().trim().min(10).max(500),
}).refine((input) => new Set(input.permissions).size === input.permissions.length, {
  path: ['permissions'], message: 'Permissions must not contain duplicates.',
});
export const revokeAdminInvitationSchema = z.object({ reason: z.string().trim().min(10).max(500) });
export const acceptAdminInvitationSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const adminCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
  search: z.string().trim().max(80).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION']).optional(),
  plan: z.enum(['FREE', 'CREATOR', 'PRO', 'AGENCY', 'PAID']).optional(),
});
export const customerLifecycleSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

export type UpdateAdminRole = z.infer<typeof updateAdminRoleSchema>;
export type AddAdmin = z.infer<typeof addAdminSchema>;
export type UpdateAdminPermissions = z.infer<typeof adminPermissionsSchema>;
export type CreateAdminInvitation = z.infer<typeof createAdminInvitationSchema>;
export type AdminCustomersQuery = z.infer<typeof adminCustomersQuerySchema>;
