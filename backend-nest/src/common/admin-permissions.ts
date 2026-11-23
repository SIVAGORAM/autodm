import { SetMetadata } from '@nestjs/common';

export const ADMIN_PERMISSIONS = [
  'SUPPORT_MANAGE',
  'PROFILE_MODERATE',
  'CONTACT_MANAGE',
  'MAIL_READ',
  'OPERATIONS_READ',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermission[] = [];
export const ADMIN_PERMISSION_METADATA = 'heylaunch:admin-permission';

export function RequireAdminPermission(permission: AdminPermission) {
  return SetMetadata(ADMIN_PERMISSION_METADATA, permission);
}
