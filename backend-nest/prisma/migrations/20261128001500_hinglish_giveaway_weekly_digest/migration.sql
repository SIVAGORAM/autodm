-- AlterEnum
ALTER TYPE "AutomationLanguage" ADD VALUE 'HINGLISH';

-- AlterTable automations
ALTER TABLE "automations" ADD COLUMN "isGiveaway" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable users
ALTER TABLE "users" ADD COLUMN "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastWeeklyDigestAt" TIMESTAMP(3);

-- CreateTable giveaway_entries
CREATE TABLE "giveaway_entries" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "igUsername" TEXT,
    "igScopedId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENTERED',
    "wonAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaway_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "giveaway_entries_automationId_contactId_key" ON "giveaway_entries"("automationId", "contactId");
CREATE UNIQUE INDEX "giveaway_entries_automationId_ticketNumber_key" ON "giveaway_entries"("automationId", "ticketNumber");
CREATE INDEX "giveaway_entries_automationId_idx" ON "giveaway_entries"("automationId");

-- AddForeignKey
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "giveaway_entries" ADD CONSTRAINT "giveaway_entries_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
