CREATE TABLE "dm_quota_reservations" (
    "id" TEXT NOT NULL,
    "triggerEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dm_quota_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dm_quota_reservations_triggerEventId_key" ON "dm_quota_reservations"("triggerEventId");
CREATE INDEX "dm_quota_reservations_userId_createdAt_idx" ON "dm_quota_reservations"("userId", "createdAt");
CREATE INDEX "dm_quota_reservations_automationId_createdAt_idx" ON "dm_quota_reservations"("automationId", "createdAt");
