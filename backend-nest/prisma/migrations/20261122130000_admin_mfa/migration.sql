ALTER TABLE "users"
    ADD COLUMN "adminMfaEnabledAt" TIMESTAMP(3),
    ADD COLUMN "adminMfaSecretEnc" TEXT,
    ADD COLUMN "adminMfaPendingSecretEnc" TEXT,
    ADD COLUMN "adminMfaRecoveryCodeHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "adminMfaChallengeHash" TEXT,
    ADD COLUMN "adminMfaChallengeExpiresAt" TIMESTAMP(3),
    ADD COLUMN "adminMfaLastUsedStep" BIGINT;

CREATE INDEX "users_adminMfaChallengeExpiresAt_idx" ON "users"("adminMfaChallengeExpiresAt");
