CREATE TYPE "InstagramLoginMode" AS ENUM ('INSTAGRAM_LOGIN', 'UNIFIED_LOGIN');

ALTER TABLE "ig_accounts"
  ADD COLUMN "loginMode" "InstagramLoginMode" NOT NULL DEFAULT 'INSTAGRAM_LOGIN',
  ADD COLUMN "clientBusinessId" TEXT,
  ADD COLUMN "unifiedConfigId" TEXT;
