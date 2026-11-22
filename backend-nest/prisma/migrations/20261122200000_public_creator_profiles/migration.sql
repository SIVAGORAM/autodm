CREATE TYPE "PublicProfileVisibility" AS ENUM ('PRIVATE', 'PUBLIC');
CREATE TYPE "ProfileAppearance" AS ENUM ('LIGHT', 'DARK', 'NEUTRAL');
CREATE TYPE "ProfileLinkKind" AS ENUM ('SOCIAL', 'CUSTOM');

CREATE TABLE "public_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currentHandleId" TEXT,
  "displayName" VARCHAR(80) NOT NULL,
  "bio" VARCHAR(160),
  "avatarAssetId" TEXT,
  "avatarDeliveryUrl" TEXT,
  "visibility" "PublicProfileVisibility" NOT NULL DEFAULT 'PRIVATE',
  "appearance" "ProfileAppearance" NOT NULL DEFAULT 'NEUTRAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "public_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_handles" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "username" VARCHAR(30) NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "profile_handles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_links" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "kind" "ProfileLinkKind" NOT NULL,
  "platform" VARCHAR(24),
  "title" VARCHAR(80) NOT NULL,
  "url" VARCHAR(2048) NOT NULL,
  "description" VARCHAR(200),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "profile_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_asset_deletions" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_asset_deletions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_profiles_userId_key" ON "public_profiles"("userId");
CREATE UNIQUE INDEX "public_profiles_currentHandleId_key" ON "public_profiles"("currentHandleId");
CREATE INDEX "public_profiles_visibility_updatedAt_idx" ON "public_profiles"("visibility", "updatedAt");
CREATE UNIQUE INDEX "profile_handles_username_lower_key" ON "profile_handles"(LOWER("username"));
CREATE UNIQUE INDEX "profile_handles_one_current_key" ON "profile_handles"("profileId") WHERE "isCurrent" = TRUE;
CREATE INDEX "profile_handles_profileId_isCurrent_idx" ON "profile_handles"("profileId", "isCurrent");
CREATE INDEX "profile_links_profileId_kind_sortOrder_idx" ON "profile_links"("profileId", "kind", "sortOrder");
CREATE UNIQUE INDEX "profile_asset_deletions_assetId_key" ON "profile_asset_deletions"("assetId");
CREATE INDEX "profile_asset_deletions_nextAttemptAt_createdAt_idx" ON "profile_asset_deletions"("nextAttemptAt", "createdAt");

ALTER TABLE "public_profiles"
  ADD CONSTRAINT "public_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_handles"
  ADD CONSTRAINT "profile_handles_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "public_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public_profiles"
  ADD CONSTRAINT "public_profiles_currentHandleId_fkey"
  FOREIGN KEY ("currentHandleId") REFERENCES "profile_handles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "profile_links"
  ADD CONSTRAINT "profile_links_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "public_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
