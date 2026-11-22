import {
  acceptAdminInvitationSchema, addAdminSchema, adminPermissionsSchema,
  createAdminInvitationSchema, updateAdminRoleSchema,
} from './admin.dto';

describe('admin DTO validation', () => {
  it('requires a valid account email and a reason of at least ten characters', () => {
    expect(addAdminSchema.safeParse({ email: 'person@example.test', reason: 'Support coverage' }).success).toBe(true);
    expect(addAdminSchema.safeParse({ email: 'not-an-email', reason: 'short' }).success).toBe(false);
  });

  it('limits role changes to known roles and requires a reason', () => {
    expect(updateAdminRoleSchema.safeParse({ role: 'ADMIN', reason: 'Support coverage' }).success).toBe(true);
    expect(updateAdminRoleSchema.safeParse({ role: 'ROOT', reason: 'Support coverage' }).success).toBe(false);
    expect(updateAdminRoleSchema.safeParse({ role: 'INFLUENCER', reason: ' ' }).success).toBe(false);
  });

  it('accepts only unique recognized admin permissions with a reason', () => {
    expect(adminPermissionsSchema.safeParse({ permissions: ['CONTACT_MANAGE', 'MAIL_READ'], reason: 'Assign support queue access' }).success).toBe(true);
    expect(adminPermissionsSchema.safeParse({ permissions: ['UNKNOWN'], reason: 'Assign support queue access' }).success).toBe(false);
    expect(adminPermissionsSchema.safeParse({ permissions: ['MAIL_READ', 'MAIL_READ'], reason: 'Assign support queue access' }).success).toBe(false);
  });

  it('validates admin invitations with optional known grants and a one-use token format', () => {
    expect(createAdminInvitationSchema.safeParse({ email: 'new@example.test', reason: 'Invite operations support' }).success).toBe(true);
    expect(createAdminInvitationSchema.safeParse({ email: 'new@example.test', permissions: ['CONTACT_MANAGE'], reason: 'Invite operations support' }).success).toBe(true);
    expect(createAdminInvitationSchema.safeParse({ email: 'new@example.test', permissions: ['ROOT'], reason: 'Invite operations support' }).success).toBe(false);
    expect(acceptAdminInvitationSchema.safeParse({ token: 'd'.repeat(43) }).success).toBe(true);
    expect(acceptAdminInvitationSchema.safeParse({ token: 'short' }).success).toBe(false);
  });
});
