# Database architecture

## Engine and access layer

The active backend uses PostgreSQL through Prisma 6 (`backend-nest/prisma/schema.prisma`). `DATABASE_URL` is the runtime connection and `DIRECT_URL` is used for direct schema operations. The repository contains a second Prisma schema under legacy `backend/`; its migrations must not be applied to the active database.

Authorization is enforced in application services and controllers. No PostgreSQL row-level security policies are defined. Every new user-facing query must scope records through the authenticated user or an owned parent record.

## Entities and ownership

| Entity | Purpose and ownership |
|---|---|
| `User` | Account identity, verification, plan/trial dates, monthly DM counter, password reset state, and pending-deletion timestamp |
| `MailOutbox` | Encrypted auth/welcome email payloads, expiry, retry state, and a cascading optional user reference |
| `RefreshToken` | Unique SHA-256 digest of each rotating refresh JWT and expiry; cascades on user deletion. The in-place conversion is now applied to the configured development/testing Neon database: all 19 pre-existing rows remain and contain 64-character SHA-256 digests. Staging/production rollout remains unverified |
| `IgAccount` | Instagram identity, encrypted token, expiry and active state; belongs to a user and owns linked webhook receipts |
| `Automation` | Trigger, matching rules, status, message blocks, and daily DM counter; belongs to an Instagram account |
| `FollowUp` | Ordered delayed condition and message blocks; cascades with automation |
| `Contact` | Instagram-scoped recipient ID, username, private notes/tags, reply/interactions and sent count; unique per account and scoped ID |
| `Run` | Primary/follow-up delivery status, error, recipient, and timestamps; unique `triggerEventId`; tracks optional public comment reply attempt/result; account/automation deletion cascades |
| `TrackedLink` / `Click` | URL slug, target URL, aggregate click count, and click events |
| `WebhookEvent` | Unique deterministic Meta event receipt, optional cascading Instagram-account owner, temporary JSON payload, attempts, backoff, processed/dead-letter timestamps, admin redrive count/actor/time, and payload-purge timestamp |
| `DmQuotaReservation` | Unique trigger-event quota claim, settlement state, and the monthly/daily window ends needed to safely refund definite no-send outcomes |
| `Payment` | Unique Razorpay order/payment identifiers, tier, amount, currency and nullable user relation; user deletion detaches the row to preserve transaction references |
| `MetaDataDeletionRequest` | SHA-256 request identity and opaque completion code, retained for 90 days so Meta's status URL can verify completed purges without retaining the Instagram user ID |
| `MetaDeauthorizationReceipt` | SHA-256 request identity used to deduplicate valid Meta deauthorization retries; purged after 90 days |
| `PublicProfile` / `ProfileHandle` | One public-profile record per creator and durable username history; a case-insensitive unique index protects claims, one partial unique index limits a profile to one current handle, and retired handles remain reserved and temporarily redirect (HTTP 307) to the current username only while the profile is public. Usernames can change no more than once every 30 days and are never recycled. |
| `ProfileLink` | Owner-controlled social/custom URLs, descriptions, ordering, and visibility; public lookup returns visible links only |
| `ProfileAssetDeletion` | Durable cleanup queue for replaced/removed Cloudinary avatar assets, retried by scheduled maintenance |

## Integrity and transactions

- Unique constraints protect email, case-insensitive profile usernames/current-handle ownership, Instagram user ID, account-scoped contacts, run event IDs, tracked slugs, webhook event IDs, quota reservations, mail outbox dedupe keys, and payment order/payment IDs.
- User monthly and automation daily quota counters use conditional updates inside a transaction. Event reservations prevent duplicate event processing from double-counting. Confirmed sends are consumed, definite skipped/failed deliveries release both counters only while the original quota windows are still active, and unknown outcomes remain reserved because Meta may have accepted the send.
- Automation create/update wraps the parent row, follow-ups, and tracked link synchronization in a transaction.
- Instagram account linking uses a serializable transaction with bounded retry for PostgreSQL write conflicts to prevent concurrent OAuth callbacks exceeding account limits.
- Razorpay browser verification and signed capture webhooks fetch provider state first, then write a unique payment and extend the plan in a serializable transaction. Bounded P2034 retries ensure concurrent distinct orders extend from the latest committed expiry instead of overwriting one another.
- Prisma relations use cascades for dependent automation/contact/webhook records, `SET NULL` for deleted contact and user references on runs/payments, and `CASCADE` for auth sessions.

## Migrations and operations

Chronological migrations live under `backend-nest/prisma/migrations/`. Recent additions align user plan fields, record payments, add daily quota counters, make webhook receipts durable, add quota reservations, add the `UNKNOWN` run status, support staged account deletion, add the encrypted mail outbox, add support request/message threads, hash existing refresh tokens, add Meta deletion/deauthorization receipts, add contact notes/tags, track quota reservation settlement, add webhook subscription state, Unified Instagram Login metadata, the Super Admin/customer operations system, and admin-audit immutability. On 2026-11-22, six admin/contact migrations were applied to the operator-confirmed development/testing Neon database; a later admin-audit immutability migration brought the chain to 30. The last successful Prisma status check reported all 30 local migrations applied and schema validation passed. A fresh status attempt on 2026-11-23 failed to start the Prisma schema engine; a guarded direct read-only PostgreSQL connection then failed DNS resolution before issuing a query, so current remote status remains unconfirmed. The contact migration was corrected to add `mail_outbox.contactEnquiryMessageId` before its unique index and foreign key. Staging and production still need independent schema comparison and tested rollout; no production/staging database was changed.

Read-only inspection on 2026-11-21 found PostgreSQL 17 and one completed `_prisma_migrations` row named `20260320070456_init`. Its checksum matched the migration file under legacy `backend/prisma/migrations`; that migration describes the older campaign-based backend, not the active Nest chain. Before reconciliation, `migrate status` found no common migration and 18 Nest migrations pending. `prisma db pull --print` showed 10 application tables and no `payments`, quota reservations, mail outbox, support threads, Meta callback receipts, or contact `notes`/`tags`; several `User`, `Run`, and `WebhookEvent` fields required by active code were also absent. The operator's prior `db push` attempt reported 19 refresh-token rows and refused the `token` to `tokenHash` transition. After the data-preserving baseline reconciliation and deployment, a read-only verification confirmed 18 active Nest migration rows, zero unfinished migrations, 19 refresh-token rows and 19 valid hashes, no old `token` column, the new `tokenHash` and contact notes/tags columns, and all expected payment/quota/mail/support/Meta receipt tables. The legacy backend migration file remains available in the repository; only its superseded database ledger row was removed. The operator confirmed this is a development/testing Neon environment. No `db push --force-reset`, production/staging migration, or application-row deletion was performed. Staging and production still need their own schema comparison and tested rollout.

There is no repository-defined backup, point-in-time recovery, restore drill, general retention cleanup, or production database monitoring. Dead-letter webhook payloads are purged after the configured retention period (default 30 days; `WEBHOOK_PAYLOAD_RETENTION_DAYS` allows 1–365), while the receipt row remains to prevent provider-event replay. Expired dead-letter receipts can no longer be redriven. Other idempotency records still have no general purge policy. A user-scoped JSON data export exists at `/api/users/export`; it excludes credentials and raw provider webhook payloads. Self-service account deletion is staged in code and detaches payment rows, but migration, active-job draining, provider-side token revocation, and final purge need staging verification.
