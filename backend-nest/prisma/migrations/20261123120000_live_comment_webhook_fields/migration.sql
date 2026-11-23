ALTER TABLE "ig_accounts"
ADD COLUMN "webhookFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Before this migration, successful account subscriptions requested only
-- comments and messages. Preserve that verified state without implying that
-- live_comments was subscribed.
UPDATE "ig_accounts"
SET "webhookFields" = ARRAY['comments', 'messages']::TEXT[]
WHERE "webhookSubscribedAt" IS NOT NULL;

-- Do not silently activate historical rules now that the trigger is supported.
UPDATE "automations"
SET "status" = 'PAUSED'
WHERE "triggerType" = 'LIVE_COMMENT' AND "status" = 'LIVE';
