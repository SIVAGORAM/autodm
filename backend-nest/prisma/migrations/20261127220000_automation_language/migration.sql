CREATE TYPE "AutomationLanguage" AS ENUM (
  'ENGLISH',
  'TENGLISH',
  'TELUGU_ENGLISH'
);

ALTER TABLE "automations"
  ADD COLUMN "language" "AutomationLanguage" NOT NULL DEFAULT 'ENGLISH';
