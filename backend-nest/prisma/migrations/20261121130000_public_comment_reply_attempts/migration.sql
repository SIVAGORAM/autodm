ALTER TABLE "runs"
  ADD COLUMN "publicReplyAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "publicReplyError" TEXT;
