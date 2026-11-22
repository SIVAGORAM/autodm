-- Refresh JWTs are high-entropy bearer credentials. Store only their SHA-256
-- digest so a database read cannot be used to replay active sessions.
ALTER TABLE "refresh_tokens" RENAME COLUMN "token" TO "tokenHash";

UPDATE "refresh_tokens"
SET "tokenHash" = encode(sha256(convert_to("tokenHash", 'UTF8')), 'hex');

ALTER INDEX "refresh_tokens_token_key" RENAME TO "refresh_tokens_tokenHash_key";
