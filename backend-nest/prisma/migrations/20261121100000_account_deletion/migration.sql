ALTER TABLE "users" ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);
CREATE INDEX "users_deletionRequestedAt_idx" ON "users"("deletionRequestedAt");

ALTER TABLE "payments" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "webhook_events" ADD COLUMN "igUserId" TEXT;
ALTER TABLE "webhook_events" ADD COLUMN "igAccountId" TEXT;
UPDATE "webhook_events"
SET "igUserId" = "payload" #>> '{entry,0,id}'
WHERE "igUserId" IS NULL AND "payload" IS NOT NULL;
UPDATE "webhook_events" AS event
SET "igAccountId" = account."id"
FROM "ig_accounts" AS account
WHERE event."igUserId" = account."igUserId" AND event."igAccountId" IS NULL;
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_igAccountId_fkey"
  FOREIGN KEY ("igAccountId") REFERENCES "ig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "webhook_events_igUserId_createdAt_idx"
  ON "webhook_events"("igUserId", "createdAt");
CREATE INDEX "webhook_events_igAccountId_createdAt_idx"
  ON "webhook_events"("igAccountId", "createdAt");
