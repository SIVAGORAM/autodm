ALTER TABLE "users"
    ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "suspendedAt" TIMESTAMP(3),
    ADD COLUMN "suspensionReason" TEXT;

CREATE INDEX "users_suspendedAt_createdAt_idx" ON "users"("suspendedAt", "createdAt");
