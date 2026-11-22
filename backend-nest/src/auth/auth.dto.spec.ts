import { PRIVACY_VERSION, TERMS_VERSION } from '../legal/policy-versions';
import { signupSchema, verifyOtpSchema } from './auth.dto';

describe('signup legal acceptance', () => {
  const validSignup = {
    name: 'Creator',
    email: 'creator@example.test',
    password: 'StrongPass1!',
    termsAccepted: true,
    privacyAcknowledged: true,
    ageConfirmed: true,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  };

  it('requires acceptance of the current terms/privacy versions and adult self-attestation', () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
    expect(signupSchema.safeParse({ ...validSignup, termsAccepted: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, privacyAcknowledged: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, ageConfirmed: false }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, termsVersion: 'old-version' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...validSignup, privacyVersion: 'old-version' }).success).toBe(false);
  });

  it('keeps frontend and backend policy-version constants aligned', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const frontendVersions = fs.readFileSync(path.resolve(__dirname, '../../../frontend/lib/legal-policy.ts'), 'utf8');
    expect(frontendVersions).toContain(`TERMS_VERSION = '${TERMS_VERSION}'`);
    expect(frontendVersions).toContain(`PRIVACY_VERSION = '${PRIVACY_VERSION}'`);
  });
});

describe('OTP verification request validation', () => {
  it('accepts only a six-digit string and rejects extra fields', () => {
    expect(verifyOtpSchema.safeParse({ code: '012345' }).success).toBe(true);
    expect(verifyOtpSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ code: '1234567' }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ code: 123456 }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ code: '123456', extra: true }).success).toBe(false);
  });
});
