-- Give each active refresh token its own session family before application code
-- starts issuing family-scoped tokens. Existing sessions remain valid; their
-- next refresh token inherits the assigned family id.
ALTER TABLE "refresh_tokens" ADD COLUMN "familyId" UUID;
UPDATE "refresh_tokens" SET "familyId" = gen_random_uuid() WHERE "familyId" IS NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "familyId" SET NOT NULL;
CREATE UNIQUE INDEX "refresh_tokens_userId_familyId_key" ON "refresh_tokens"("userId", "familyId");