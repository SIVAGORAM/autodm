# Backend architecture

## Active services

`backend-nest/src/app.module.ts` is the active NestJS application. It composes auth, automation, Instagram, webhook, payment, tracking, user, trial, mail, Meta, Prisma, queue, and common modules. The HTTP process uses Fastify; `backend-nest/src/worker.ts` creates a separate Nest application context and BullMQ workers without binding an HTTP port. `backend/` is a separate legacy Express implementation and is not included in the current Render Blueprint.

## Request and data layers

Controllers parse request bodies with Zod and call services. JWT authentication accepts the HTTP-only access cookie or a Bearer token; the email verification guard reads current verification state from PostgreSQL. Services implement ownership checks, plan resolution, business rules, transactions, and provider calls. Prisma is the data layer; there is no separate repository abstraction. Nest exceptions are used for expected HTTP errors; unexpected exceptions flow through Nest's default handler.

Global throttling is configured at 120 requests per minute, with stricter route-level limits on signup, login, OTP, and password recovery. Its atomic sliding-window counters are stored in shared Redis under hashed tracker keys; `/ready` checks that connection and `/health` remains available when it is down. Fastify trusts one proxy hop for client IP resolution. Unsafe browser mutations are checked against the configured `CORS_ORIGIN`; Instagram webhooks rely on HMAC signature verification.

## Main modules

- `auth/`: signup, login, JWT issue/refresh/logout, OTP verification, password reset.
- `instagram/`: signed OAuth state, Instagram Login code exchange, account/media endpoints, token refresh service.
- `automations/`: Zod DTOs, ownership and plan checks, CRUD, status changes, health, run pagination, and analytics.
- `webhook/`: Meta handshake/signature validation, durable event receipt, matching, quota reservation, and queue submission.
- `queue/`: BullMQ connection and primary/follow-up DM worker logic, retry-safe run states, and quota settlement after a definitive delivery result.
- `meta/`: Graph API send/comment calls, retryability classification, and follower lookup (the latter is not reliable and new use is disabled).
- `payments/`: plan catalogue, Razorpay order creation and browser verification, signed `payment.captured` webhook, payment ledger and idempotent 30-day access grant.
- `tracking/`: public tracked-link redirect and click recording.
- `trial/`: scheduled trial-ending email sweep.
- `support/`: verified-user support and feedback threads, admin inbox and status actions, owner-scoped customer replies.
- `users/`: profile/password updates, public-profile APIs and Cloudinary avatar storage, plus a user-scoped JSON data export that excludes credentials and raw webhook payloads.
- `mail/`: SMTP templates, bounded SMTP transport timeouts, and encrypted Postgres outbox with leased retries for authentication, support, and lifecycle emails.
- `config/`, `common/`: environment validation, encryption, plan utilities, guards, and security policy.

## Background processing

The `dm` queue defaults to five attempts with exponential backoff starting at two seconds for send jobs. Durable webhook-processing jobs override this with one BullMQ attempt because PostgreSQL stores the authoritative retry deadline and attempt count; the ten-second reconciliation job requeues each receipt when its `nextAttemptAt` is due. Send job IDs are stable prefixed SHA-256 values so they avoid BullMQ's colon separator; database event IDs remain unchanged. The worker handles durable webhook events and send jobs with concurrency ten. Comment-triggered post/reel private replies reserve capacity through an atomic Redis rolling window capped at 700 per Instagram account per hour, leaving headroom under Meta's documented 750-call limit for sends outside HeyLaunch. Saturated jobs move into BullMQ's delayed set without consuming retries. A separate maintenance queue refreshes expiring tokens daily, reconciles webhook receipts every ten seconds, processes and purges the mail outbox, marks delivery runs stuck in `PENDING` for more than fifteen minutes as `UNKNOWN`, schedules old unverified accounts for deletion, and drains staged account deletions. Queue and database recovery paths are idempotent where their database keys permit; provider delivery itself cannot be guaranteed exactly once.

The worker logs job failures and maintenance summaries, including account-deletion maintenance errors. In development, `RUN_DELIVERY_WORKER_IN_DEVELOPMENT` opts into DM/webhook consumption, `RUN_SCHEDULED_JOBS_IN_DEVELOPMENT` opts into the full maintenance schedule, and the narrower `RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT` starts only a ten-second email-outbox loop. The mail-only switch is development-only and off by default; it can send every eligible queued email, so it must only be used with an isolated database and test SMTP recipients. In production, the regular maintenance worker processes the outbox. An admin-only API and dashboard page list bounded dead-letter metadata and allow explicit redrive. The operations runbook documents safe handling; external error tracking, a queue dashboard, and automated dead-letter notifications remain absent.

The authenticated `GET /api/dashboard/events` route streams user-scoped Server-Sent Events. `DashboardEventsService` publishes only allowlisted resource invalidations over Redis Pub/Sub after durable webhook processing or terminal delivery updates; payloads omit user IDs and customer content. The stream checks JWT/session and verified-email guards at connection and ends after twelve minutes so EventSource reconnects and revalidates. It is advisory: API queries remain the source of truth and the frontend continues polling when the stream is disconnected. Local Chrome Network inspection verified an authenticated `200` EventSource connection and receipt of a `keepalive` event. This proves session authorization and stream transport, not Redis invalidation delivery or Meta-to-worker processing.

## Known architecture risks

- Run records cover both primary sends and individual follow-up messages.
- Automation deletion pauses matching first, removes its pending/delayed BullMQ jobs, waits up to fifteen seconds for active jobs to drain, then cascades database deletion. Queue outages or active work leave the automation paused for a safe retry. Worker status checks prevent new sends or follow-up scheduling after pause.
- A delivery marked `UNKNOWN` has no built-in operator/customer retry action.
- `MetaService` retries only selected provider error codes; non-retryable errors become failed runs.
- The follower lookup uses a business-discovery style query with a scoped Instagram ID and is not a valid follower-status implementation; current create/update validation rejects new use.
- HTTP `/health` is a process response only; it does not test PostgreSQL, Redis, mail, or worker readiness.
- OAuth/provider exception detail needs continued redaction review; never log tokens, authorization codes, or full request payloads.
