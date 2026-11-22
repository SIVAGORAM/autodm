import { z } from 'zod';
import { PRIVACY_VERSION, TERMS_VERSION } from '../legal/policy-versions';

export const legalAcceptanceSchema = z.object({
  termsAccepted: z.literal(true),
  privacyAcknowledged: z.literal(true),
  ageConfirmed: z.literal(true),
  termsVersion: z.literal(TERMS_VERSION),
  privacyVersion: z.literal(PRIVACY_VERSION),
});

export const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
}).extend(legalAcceptanceSchema.shape);
export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const adminMfaCodeSchema = z.object({ code: z.string().trim().min(1).max(32) });
export const adminMfaSetupSchema = z.object({ currentPassword: z.string().min(1).max(128) });

export const verifyOtpSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
}).strict();

export const forgotPasswordSchema = z.object({ email: z.string().email().toLowerCase() });

export const resetPasswordSchema = z.object({
  token: z.string().length(64),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
});
