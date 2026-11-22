ALTER TABLE "users"
ADD COLUMN "adminPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Preserve current ADMIN capabilities during rollout. A Super Admin can then
-- remove unneeded permissions in the team console. Newly promoted admins get
-- the same explicit baseline in application code.
UPDATE "users"
SET "adminPermissions" = ARRAY['SUPPORT_MANAGE', 'CONTACT_MANAGE', 'MAIL_READ', 'OPERATIONS_READ']::TEXT[]
WHERE "role" = 'ADMIN';
