ALTER TABLE "webhook_events"
  ADD COLUMN "redriveCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastRedrivenAt" TIMESTAMP(3),
  ADD COLUMN "lastRedrivenBy" TEXT,
  ADD COLUMN "payloadPurgedAt" TIMESTAMP(3);

CREATE INDEX "webhook_events_deadLetterAt_createdAt_idx"
  ON "webhook_events"("deadLetterAt", "createdAt");
