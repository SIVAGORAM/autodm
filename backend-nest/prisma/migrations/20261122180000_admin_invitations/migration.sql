CREATE TABLE "admin_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_invitations_tokenHash_key" ON "admin_invitations"("tokenHash");
CREATE INDEX "admin_invitations_email_acceptedAt_revokedAt_expiresAt_idx"
ON "admin_invitations"("email", "acceptedAt", "revokedAt", "expiresAt");
CREATE INDEX "admin_invitations_invitedById_createdAt_idx"
ON "admin_invitations"("invitedById", "createdAt");
CREATE UNIQUE INDEX "admin_invitations_one_open_email_key"
ON "admin_invitations"("email") WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

ALTER TABLE "admin_invitations"
ADD CONSTRAINT "admin_invitations_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_invitations"
ADD CONSTRAINT "admin_invitations_acceptedById_fkey"
FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
