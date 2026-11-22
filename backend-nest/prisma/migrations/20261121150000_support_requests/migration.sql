CREATE TYPE "SupportRequestType" AS ENUM ('SUPPORT', 'FEEDBACK');
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE "SupportMessageSender" AS ENUM ('CUSTOMER', 'ADMIN');

CREATE TABLE "support_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "SupportRequestType" NOT NULL,
  "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
  "subject" TEXT NOT NULL,
  "rating" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_requests_rating_feedback_check" CHECK (
    "rating" IS NULL OR ("type" = 'FEEDBACK' AND "rating" BETWEEN 1 AND 5)
  )
);

CREATE TABLE "support_messages" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "authorId" TEXT,
  "senderType" "SupportMessageSender" NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_requests_userId_createdAt_idx" ON "support_requests"("userId", "createdAt");
CREATE INDEX "support_requests_status_createdAt_idx" ON "support_requests"("status", "createdAt");
CREATE INDEX "support_messages_requestId_createdAt_idx" ON "support_messages"("requestId", "createdAt");
CREATE INDEX "support_messages_authorId_createdAt_idx" ON "support_messages"("authorId", "createdAt");

ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
