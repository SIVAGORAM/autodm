# API and data architecture

Active API: `backend-nest/src/`, NestJS controllers are mounted under the prefixes shown below. Unless noted, endpoints require JWT authentication; account/billing/automation endpoints also require verified email.

## HTTP endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Create account and transactionally queue OTP email |
| POST | `/api/auth/login` | Authenticate and set cookies |
| POST | `/api/auth/refresh` | Rotate refresh token |
| POST | `/api/auth/logout` | Revoke refresh token |
| GET | `/api/auth/me` | Current user/profile summary |
| POST | `/api/auth/verify-otp`, `/resend-otp` | Verify/resend email OTP |
| GET | `/api/auth/verification-email-status` | Return the authenticated account's current OTP email queue state without exposing recipient or payload data; `sent` means SMTP accepted the message, not inbox delivery |
| POST | `/api/auth/accept-policies` | Record current versioned Terms/Privacy acceptance and age confirmation for an authenticated user |
| POST | `/api/auth/forgot-password`, `/reset-password` | Password reset flow |
| GET | `/api/instagram/auth-url` | Generate signed short-lived OAuth state and bind it to an HTTP-only callback cookie |
| GET | `/api/instagram/callback` | Exchange authorization code and persist encrypted token |
| POST | `/api/instagram/data-deletion` | Validate Meta `signed_request`, drain the account queue, delete data owned by that Instagram account, and return a completion code/status URL |
| GET | `/api/instagram/data-deletion/status` | Public, no-store completion status lookup by opaque confirmation code |
| POST | `/api/instagram/deauthorize` | Verify Meta Business Login `signed_request`, pause automations, disable the account, and erase its local token |
| GET | `/api/instagram/accounts` | List connected accounts (never returns token) |
| GET | `/api/instagram/accounts/:id/media` | List media owned by the account |
| POST | `/api/instagram/accounts/:id/webhooks/subscribe` | Owner-authenticated retry of Meta `comments,messages` per-account webhook subscription |
| DELETE | `/api/instagram/accounts/:id` | Pause automations, drain active sends and queued jobs, disable the account, and erase its local token |
| POST/GET | `/api/automations` | Create/list automations |
| GET/PATCH/DELETE | `/api/automations/:id` | Read/update/delete an owned automation |
| PATCH | `/api/automations/:id/status` | Change DRAFT/LIVE/PAUSED state |
| GET | `/api/automations/:id/analytics`, `/runs` | Counts and paginated run log |
| GET | `/api/payments/plans`, `/subscription` | Plan catalogue and current usage |
| POST | `/api/payments/order`, `/verify` | Authenticated manual checkout and verification |
| POST | `/api/payments/webhook` | Public Razorpay callback; raw-body HMAC authenticated, processes captured payments idempotently |
| PUT | `/api/users/profile`, `/profile/password` | Profile and password changes |
| GET | `/api/users/public-profile` | Read the authenticated creator profile and report avatar-storage availability |
| GET | `/api/users/public-profile/username-availability` | Rate-limited username availability check with normalized, case-insensitive lookup |
| POST | `/api/users/public-profile` | Create/update an owned profile, username handle, social links, custom links, visibility, and appearance |
| POST/DELETE | `/api/users/public-profile/avatar` | Upload or remove a validated profile avatar through configured Cloudinary storage |
| GET | `/api/public/profiles/:username` | Public, no-store profile lookup; returns visible profile links only, or a retired-handle redirect target |
| DELETE | `/api/users/account` | JWT-authenticated, password/email-confirmed deletion request; available before email verification, disables sessions/automations immediately, and purges account data after an operational 15-minute processing delay and queue drain. The delay is not cancellable and no restore path exists. |
| GET | `/api/users/contacts` | Search and paginate contacts owned by the authenticated user, optionally filtered to an owned Instagram account |
| PATCH | `/api/users/contacts/:id` | Replace private notes (up to 2,000 chars) and tags (up to 10, 24 chars each) on a contact owned by the authenticated user |
| GET | `/api/users/contacts/export` | Stream a filtered CSV export in batches, including notes/tags; excludes Instagram-scoped IDs and email fields |
| GET | `/api/admin/webhook-events/dead-letter` | Admin-only, paginated metadata for unprocessed dead-letter receipts; no raw payload or provider ID |
| POST | `/api/admin/webhook-events/:id/redrive` | Admin-only, rate-limited redrive; records actor/time and returns pending recovery if Redis enqueue fails |
| GET | `/api/admin/mail-outbox` | Admin-only, paginated, redacted transactional-mail status and aggregate counts; no recipient, user ID, or message payload |
| GET | `/r/:slug` | Record click and redirect to target URL |
| GET/POST | `/webhooks/instagram` | Meta challenge and signed event ingestion |
| GET | `/api/users/export` | Download one authenticated user’s scoped data as JSON; excludes credentials and raw provider webhook payloads |
| GET | `/health` | Process health response |
| GET | `/ready` | Readiness check for PostgreSQL and Redis dependencies |
| POST | `/api/support/requests` | Create a verified-user support request or feedback item with its first message |
| GET | `/api/support/requests/mine` | List the authenticated user’s latest 50 support/feedback threads |
| POST | `/api/support/requests/:id/messages` | Reply to the authenticated owner’s unresolved support request |
| GET | `/api/admin/support-requests` | Admin-only, paginated support/feedback inbox, optionally filtered by status |
| PATCH | `/api/admin/support-requests/:id/status` | Admin-only request status update |
| POST | `/api/admin/support-requests/:id/messages` | Admin-only reply to a support/feedback thread |

Support notification email payloads are encrypted in the durable mail outbox and use the existing worker retry policy. Admin alerts for support/feedback submissions and customer replies are queued only when `SUPPORT_NOTIFICATION_EMAIL` is configured; customer message bodies are never included in these notification emails. Unverified users can inspect the outbox state for their current OTP through the authenticated status endpoint; reset/support mail still has no customer-facing delivery status. SMTP delivery has not been verified in staging.

## PostgreSQL entities

Prisma schema is `backend-nest/prisma/schema.prisma`.

- `User` owns Instagram accounts, refresh tokens, payments, and transactional mail outbox rows. It stores verification, plan, trial, quota, password-reset fields, account-deletion request timestamp, and versioned Terms/Privacy acknowledgment timestamps plus adult self-attestation time.
- `IgAccount` belongs to one user; encrypted access token is stored in `accessTokenEnc`. `igUserId` is unique. `webhookSubscribedAt` records the last successful Meta comments/messages field subscription; comment automations cannot be activated until this is set. Accounts own automations, contacts, and runs.
- `Automation` belongs to an Instagram account and contains trigger, matcher, status, public replies, JSON DM blocks, and a daily quota counter/reset time. It owns follow-ups, runs, and tracked links.
- `Contact` is unique per Instagram account and scoped Instagram ID. It stores username, email (currently no capture flow), follower flag, DM count, reply timestamps, and owner-scoped CRM notes/tags. Notes and tags are included in account and CSV exports and cascade with their Instagram account.
- `Run` belongs to an automation and account, may reference a contact, and uniquely indexes `triggerEventId` as an idempotency key. Primary and follow-up messages have separate keys; `followUpOrder` is a historical step snapshot.
- `SupportRequest` belongs to one user and is typed as support or feedback; it stores status, subject, optional feedback rating, and timestamps. `SupportMessage` stores the ordered customer/admin thread, with request cascade and nullable author reference. The owner’s account export includes thread bodies; user deletion cascades the request and messages.
- `FollowUp` belongs to an automation and stores ordered condition, delay, and JSON blocks.
- `TrackedLink` belongs to an automation; unique slug redirects to its target and owns click events. Contact attribution in outgoing DM links is HMAC-bound to both the slug and contact ID; unsigned or tampered `c` query values count only as aggregate clicks.
- `WebhookEvent` has a unique deterministic provider event ID, a cascading optional Instagram-account link, temporary JSON payload, attempt/error/backoff fields, processed/dead-letter timestamps, redrive audit fields, and payload-purge timestamp. The worker reconciles pending receipts from Postgres and purges dead-letter payloads after the configured retention period, keeping the unique event row for deduplication. Admin list output is paginated metadata only; redrive resets the retry window and records the persisted admin user ID. Purged payloads cannot be redriven.
- `DmQuotaReservation` records the unique primary or follow-up message event whose user/month and automation/day quota was claimed. Reprocessing after queue/worker failure reuses this reservation rather than counting the same message again.
- `MailOutbox` stores encrypted verification, reset, welcome, and support-notification payloads with a user cascade, expiry, retry/lease state, and terminal status. OTP/reset delivery is revalidated against the current user token before the worker sends it. The admin mail view groups by status and exposes only category, state, bounded error labels, timestamps, and retry counts.
- `Payment` stores unique order/payment identifiers, plan, amount/currency, and an optional user foreign key. Account deletion detaches the transaction record while removing the user profile.
- `RefreshToken` stores a unique SHA-256 digest of the bearer refresh JWT and expiry. The migration hashes existing values in place to preserve sessions.
- `GET /api/users/export` reads the authenticated account and its related product data in a repeatable-read transaction, including versioned Terms/Privacy acceptance and adult self-attestation timestamps. Queries are scoped by the authenticated `userId`; password/reset/OTP fields, refresh tokens, access-token ciphertext, and raw webhook payloads are excluded.
- Contact inbox and CSV queries are scoped through `Contact.igAccount.userId`. The UI/API expose only username, owning account username, interaction timestamps, follower flag, and successful DM count; Instagram-scoped IDs and email fields are excluded. CSV rows are streamed in batches and spreadsheet formula prefixes are escaped.

Migrations are chronological under `backend-nest/prisma/migrations/`. The November 19 migration aligns user plan/OTP/reset fields; November 20 migrations add payment history, daily quota counters, durable webhook receipts, idempotent quota reservations, an `UNKNOWN` delivery status, and follow-up run history. November 21 migrations support staged account deletion, webhook dead-letter redrive and payload retention, public-reply retry metadata, the encrypted mail outbox, support request/message threads, refresh-token hashing, Meta callback receipts, quota settlement, and nullable legal-acceptance fields. The November 22 migrations add webhook subscription state, Unified Instagram Login metadata, Super Admin/customer operations, and admin-audit immutability. On 2026-11-22, the six Super Admin/contact migrations were applied to the operator-confirmed development/testing Neon database; a later admin-audit immutability migration brought the chain to 30. The last successful Prisma status check reported all 30 local migrations applied and the schema valid. A fresh status attempt on 2026-11-23 failed to start the Prisma schema engine; a guarded direct read-only PostgreSQL connection then failed DNS resolution before issuing a query, so remote status was not reconfirmed. The contact migration was corrected to add its nullable mail-outbox relation column before adding its unique index and foreign key. Staging/production must independently validate and apply the matching migration set before deploying code that reads these fields; no production or staging database was changed. `backend/` has a separate legacy schema and migration; do not deploy both migration sets against one database.

## Data integrity considerations

- User monthly DM quota and per-automation daily limit use conditional `UPDATE`s inside one transaction so concurrent primary and follow-up deliveries cannot claim beyond either limit. A unique event reservation makes retries idempotent across the quota-claim/queue-add boundary. Counters roll over lazily at UTC month/day boundaries. Current plan entitlements are checked both when matching the webhook and immediately before a queued send, so queued paid automation work is skipped if the user's plan expires in between.
- The run unique key and BullMQ job ID damp duplicate webhook events. They do not guarantee exactly-once sends across the Meta API/database boundary. Runs also record when an optional public comment reply received a provider response, reducing duplicate public replies when a later DM attempt retries; a crash between provider acceptance and that marker remains ambiguous.
- Account ownership is checked in Instagram and automation services; user data access should continue to scope every query by authenticated user.
- Account caps are enforced during serializable OAuth linking and again when automations are activated, matched, and sent. After downgrade, the oldest active connections retain plan slots; over-cap accounts show a plan-limited health state and matching events are logged as skipped.
- Payment records are unique by order and payment IDs. Provider validation occurs before the serializable transaction updates the plan; write conflicts retry a bounded number of times so separate concurrent purchases do not lose paid time.
- Automation PATCH accepts optional follow-up step IDs. Existing IDs must belong to the owned automation and are retained so delayed BullMQ jobs can still resolve their step; omitted existing IDs are removed and new steps receive new IDs.
- User-requested account deletion requires a JWT, current password, and typed account email; it is available before email verification. Expired unverified signups are also tombstoned after configurable `UNVERIFIED_ACCOUNT_RETENTION_DAYS` (default 30), with refresh sessions and local Instagram credentials cleared and automations paused. Both paths block JWT use immediately; after 15 minutes the worker waits for active account jobs, removes deterministic queued/delayed jobs and webhook receipts, deletes account-owned data, detaches financial transaction rows, and deletes the user row. Queue behavior and the retention setting need staging and owner/legal review.
- Webhook intake deduplicates provider event IDs, persists a batch before acknowledgment, then bulk-enqueues eligible receipts. Worker recovery requeues pending receipts. After eight handler attempts an event is dead-lettered; an admin-only API and dashboard page provide bounded listing and redrive. The endpoint uses the currently persisted `User.role=ADMIN`; there is no in-product role-management route.
- Meta documents notification batches of up to 1000 updates and retries failed deliveries over 36 hours; the current signed endpoint accepts up to 5 MiB and the batch path is covered at 1000 events. Live provider delivery and peak payload sizes still need staging verification ([Meta Webhooks getting started](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)).
- No backup/restore or general retention policy is defined in the repository. The dead-letter webhook payload retention policy is described above; other idempotency records still lack cleanup.
