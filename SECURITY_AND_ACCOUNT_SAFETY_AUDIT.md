# HEYLAUNCH — SECURITY & ACCOUNT SAFETY AUDIT

## 1. Cryptographic Key Management & Storage

- **Algorithm:** AES-256-GCM authenticated symmetric encryption for all Meta access tokens.
- **Nonce/IV Generation:** Cryptographically secure 12-byte random initialization vector (`crypto.randomBytes(12)`) generated per encryption call.
- **Authentication Tag:** 16-byte authentication tag verified prior to decryption (`decipher.setAuthTag(tag)`). Any tampering with ciphertext throws an authentication error and fails closed.
- **Key Storage:** Derived from `INSTAGRAM_TOKEN_ENCRYPTION_KEY` (must be 32 bytes hex or base64) passed via environment variables, never hardcoded.

---

## 2. Webhook Authentication & Replay Protection

- **Signature Verification:** All incoming webhook payloads undergo timing-safe HMAC-SHA256 signature verification (`crypto.timingSafeEqual`) against `META_APP_SECRET`.
- **Replay / Stale Message Guards:** Inbound messages with timestamps older than 5 minutes or differing drastically from server time are rejected to prevent replay attacks.
- **Idempotency:** Webhook event IDs are tracked in Redis/Postgres to prevent duplicate processing of the same Meta delivery event.

---

## 3. Multi-Tenant Isolation & Access Control

- **Tenant Boundaries:** All queries across `Automations`, `Contacts`, `Runs`, and `IGAccounts` enforce strict tenant tenancy via `userId` from authenticated JWTs.
- **Contact Privacy:** Contacts created by webhooks are keyed to `(igAccountId, igScopedId)`. One creator cannot access, list, or export contacts of another creator.
- **Data Deletion Compliance:** Meta Data Deletion callbacks trigger an asynchronous cascade purge removing tokens, automations, and contact interactions.
