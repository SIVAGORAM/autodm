CREATE TYPE "PublicProfileReportReason" AS ENUM (
  'IMPERSONATION',
  'SCAM',
  'INAPPROPRIATE',
  'SPAM',
  'COPYRIGHT',
  'OTHER'
);

CREATE TYPE "PublicProfileReportStatus" AS ENUM (
  'OPEN',
  'IN_REVIEW',
  'ACTIONED',
  'DISMISSED'
);

CREATE TABLE "public_profile_reports" (
  "id" TEXT NOT NULL,
  "profileId" TEXT,
  "reportedUsername" VARCHAR(30) NOT NULL,
  "reportedDisplayName" VARCHAR(80) NOT NULL,
  "reason" "PublicProfileReportReason" NOT NULL,
  "details" VARCHAR(1000),
  "status" "PublicProfileReportStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedById" TEXT,
  "moderationNote" VARCHAR(1000),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "public_profile_reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public_profiles"
  ADD COLUMN "moderationBlockedAt" TIMESTAMP(3);

CREATE INDEX "public_profile_reports_status_createdAt_id_idx"
  ON "public_profile_reports"("status", "createdAt", "id");
CREATE INDEX "public_profile_reports_profileId_createdAt_idx"
  ON "public_profile_reports"("profileId", "createdAt");

ALTER TABLE "public_profile_reports"
  ADD CONSTRAINT "public_profile_reports_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "public_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public_profile_reports"
  ADD CONSTRAINT "public_profile_reports_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
