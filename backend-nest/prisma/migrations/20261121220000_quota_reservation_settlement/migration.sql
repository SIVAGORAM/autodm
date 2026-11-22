CREATE TYPE "DmQuotaReservationStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

ALTER TABLE "dm_quota_reservations"
  ADD COLUMN "status" "DmQuotaReservationStatus" NOT NULL DEFAULT 'RESERVED',
  ADD COLUMN "monthWindowEndsAt" TIMESTAMP(3),
  ADD COLUMN "dayWindowEndsAt" TIMESTAMP(3),
  ADD COLUMN "settledAt" TIMESTAMP(3);

-- Existing reservations were already included in user and automation counters.
-- Treat them as consumed so the rollout never refunds historical quota claims.
UPDATE "dm_quota_reservations" SET "status" = 'CONSUMED';
ALTER TABLE "dm_quota_reservations" ALTER COLUMN "status" SET DEFAULT 'CONSUMED';
