ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

CREATE TABLE "admin_audit_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "reason" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_events_createdAt_id_idx" ON "admin_audit_events"("createdAt", "id");
CREATE INDEX "admin_audit_events_actorId_createdAt_idx" ON "admin_audit_events"("actorId", "createdAt");
CREATE INDEX "admin_audit_events_targetType_targetId_createdAt_idx" ON "admin_audit_events"("targetType", "targetId", "createdAt");

ALTER TABLE "admin_audit_events"
  ADD CONSTRAINT "admin_audit_events_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
