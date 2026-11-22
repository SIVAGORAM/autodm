CREATE TABLE "mail_outbox" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "payloadEnc" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mail_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mail_outbox_dedupeKey_key" ON "mail_outbox"("dedupeKey");
CREATE INDEX "mail_outbox_status_nextAttemptAt_idx" ON "mail_outbox"("status", "nextAttemptAt");
CREATE INDEX "mail_outbox_userId_createdAt_idx" ON "mail_outbox"("userId", "createdAt");
CREATE INDEX "mail_outbox_status_expiresAt_idx" ON "mail_outbox"("status", "expiresAt");
ALTER TABLE "mail_outbox" ADD CONSTRAINT "mail_outbox_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
