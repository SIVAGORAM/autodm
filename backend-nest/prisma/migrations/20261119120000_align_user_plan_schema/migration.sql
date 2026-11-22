-- Bring the database in line with the current Prisma User model and paid tiers.
-- IF NOT EXISTS keeps this safe for environments that previously used db push.
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'CREATOR';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'PRO';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'AGENCY';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialReminderSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dmCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dmCountResetAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_trialEndsAt_idx" ON "users"("trialEndsAt");
