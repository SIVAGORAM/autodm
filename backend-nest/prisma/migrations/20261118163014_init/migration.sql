-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INFLUENCER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('POST_COMMENT', 'NEXT_POST', 'ANY_POST', 'STORY_REPLY', 'LIVE_COMMENT', 'DM');

-- CreateEnum
CREATE TYPE "MatchMode" AS ENUM ('KEYWORDS', 'ANY', 'AI_INTENT');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('DRAFT', 'LIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "FollowCond" AS ENUM ('DELAY', 'LINK_NOT_CLICKED', 'NO_REPLY', 'BOUGHT', 'NOT_BOUGHT', 'FORM_NOT_SUBMITTED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profilePicUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'INFLUENCER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ig_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pageId" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastAlertAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ig_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "TriggerType" NOT NULL,
    "mediaId" TEXT,
    "matchMode" "MatchMode" NOT NULL DEFAULT 'KEYWORDS',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicReplies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "replyToComment" BOOLEAN NOT NULL DEFAULT false,
    "askToFollow" BOOLEAN NOT NULL DEFAULT false,
    "collectEmail" BOOLEAN NOT NULL DEFAULT false,
    "trackClicks" BOOLEAN NOT NULL DEFAULT true,
    "dmBlocks" JSONB NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'DRAFT',
    "dailyLimit" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "condition" "FollowCond" NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "dmBlocks" JSONB NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "igScopedId" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "email" TEXT,
    "follows" BOOLEAN NOT NULL DEFAULT false,
    "dmsSent" INTEGER NOT NULL DEFAULT 0,
    "firstInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReplyAt" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "contactId" TEXT,
    "triggerEventId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_links" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clicks" (
    "id" TEXT NOT NULL,
    "trackedLinkId" TEXT NOT NULL,
    "contactIgsid" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ig_accounts_igUserId_key" ON "ig_accounts"("igUserId");

-- CreateIndex
CREATE INDEX "ig_accounts_userId_idx" ON "ig_accounts"("userId");

-- CreateIndex
CREATE INDEX "automations_igAccountId_idx" ON "automations"("igAccountId");

-- CreateIndex
CREATE INDEX "automations_triggerType_status_idx" ON "automations"("triggerType", "status");

-- CreateIndex
CREATE INDEX "follow_ups_automationId_idx" ON "follow_ups"("automationId");

-- CreateIndex
CREATE INDEX "contacts_igAccountId_idx" ON "contacts"("igAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_igAccountId_igScopedId_key" ON "contacts"("igAccountId", "igScopedId");

-- CreateIndex
CREATE UNIQUE INDEX "runs_triggerEventId_key" ON "runs"("triggerEventId");

-- CreateIndex
CREATE INDEX "runs_automationId_idx" ON "runs"("automationId");

-- CreateIndex
CREATE INDEX "runs_igAccountId_createdAt_idx" ON "runs"("igAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_links_slug_key" ON "tracked_links"("slug");

-- CreateIndex
CREATE INDEX "tracked_links_automationId_idx" ON "tracked_links"("automationId");

-- CreateIndex
CREATE INDEX "clicks_trackedLinkId_idx" ON "clicks"("trackedLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_eventId_key" ON "webhook_events"("eventId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ig_accounts" ADD CONSTRAINT "ig_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "ig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "ig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "ig_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_links" ADD CONSTRAINT "tracked_links_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_trackedLinkId_fkey" FOREIGN KEY ("trackedLinkId") REFERENCES "tracked_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
