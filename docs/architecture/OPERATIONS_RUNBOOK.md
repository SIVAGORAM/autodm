# Operations runbook (pre-launch draft)

This runbook describes only operational controls verified in the repository. It is not evidence that production services, alerting, backups, or on-call ownership are configured. Before launch, assign named operators and provider-console access, test the procedures in staging, and add contact/escalation details.

## Service health

1. Check API liveness at `GET /health`. A successful response confirms only that the API process answers.
2. Check API readiness at `GET /ready`. A `503` means the database and/or Redis probe failed; inspect the individual `checks` fields and the host's API logs.
3. A verified administrator can inspect `GET /api/admin/health/worker` or the dashboard's Webhook operations page. `status: stale` or `unavailable` means the worker heartbeat is missing/old or Redis could not be read. The endpoint also reports waiting, active, delayed, and failed queue counts.
4. If the worker is stale, inspect the worker service's platform status and redacted logs, verify its configured Redis/database environment references, and use the hosting provider's restart procedure. Recheck heartbeat and queue movement after recovery. Do not copy credentials into tickets or chat.

The API health endpoints and admin page do not send alerts. Until external monitoring is configured, an operator must perform these checks manually.

## Instagram provider connectivity

- `GET /api/instagram/accounts/:id/media` and webhook-subscription setup require outbound HTTPS from the API process to Meta Graph endpoints. A provider-network failure is returned as HTTP `503`; the automation builder displays a retryable network/proxy message.
- Check outbound connectivity from the API service itself, including the `HTTP_PROXY`, `HTTPS_PROXY`, or `ALL_PROXY` configuration inherited by that process. A configured but unreachable proxy can prevent requests from reaching Meta even while `/ready` reports the database and queue as healthy.
- Correct the service's approved proxy/network configuration, restart the API if its environment changed, then retry media loading. Do not disable or bypass an organization/network proxy as a troubleshooting shortcut.
- Meta media loading and account webhook subscription are separate operations. A connected account with an unconfirmed webhook subscription cannot reliably trigger automations; use the dashboard's setup action only after outbound connectivity is working, then confirm receipt of a controlled staging event before enabling customer automations.

## Failed webhook receipts

1. Open the admin Webhook operations page and review the receipt type, attempt count, timestamp, account label, last redrive time, and payload availability.
2. Inspect worker logs for the event's processing failure. Logs are intentionally redacted; do not add raw customer payloads or tokens to diagnostic output.
3. Correct the underlying service/configuration issue before redrive. Confirm that the Instagram account is active and is not being deleted.
4. Redrive only when the stored payload is still available. The admin endpoint is rate-limited and records the administrator and timestamp. A response may report `pending_recovery` if Redis is unavailable; PostgreSQL reconciliation can enqueue it after Redis recovers.
5. Confirm that the receipt is processed or dead-lettered again. Redrive is not a substitute for correcting a persistent provider or deployment failure.

Dead-letter payloads are purged after `WEBHOOK_PAYLOAD_RETENTION_DAYS` (default 30 days, allowed 1–365). A purged payload cannot be redriven; the receipt remains for deduplication.

## Uncertain or failed message delivery

- `FAILED` means the application received a terminal provider failure. Resolve the account/token/content issue and use customer support procedures before promising a retry; no customer delivery-run retry endpoint is implemented.
- `UNKNOWN` means the application could not confirm whether Instagram accepted the message. Check the creator's Instagram conversation before any manual follow-up. Do not replay automatically: a retry may send a duplicate.
- BullMQ retries transient Meta/network failures up to its configured attempts. A crash after provider acceptance but before the database records `SENT` cannot be distinguished from a failed send with the current provider integration.

## Authentication, support, and welcome email delivery

- Verification, password-reset, and welcome emails enter `mail_outbox` in the same transaction as their user-state change. Payloads are encrypted; do not select or export `payloadEnc`.
- The worker checks for due rows every ten seconds and logs aggregate sent/retry/failed/canceled counts without recipient identifiers. After repairing SMTP configuration/connectivity, pending messages retry automatically until delivery, expiry, or the bounded attempt limit. A new verification code or reset request supersedes the old token, and its queued email is canceled when the worker detects that it is stale.
- `SENT` means the SMTP server accepted the message; it does not prove inbox delivery. `FAILED` means the bounded retries ended; ask the user to request a fresh verification code or reset link. `CANCELLED` means the email expired or its action was superseded.
- Open the admin Mail delivery page to review aggregate status counts and paginated, redacted metadata for pending, processing, and failed mail. The page does not expose recipients, user IDs, message payloads, or raw errors. It does not provide a manual redrive action; after fixing SMTP, pending messages retry automatically, while a user can request a new verification code or reset link.
- Support/feedback submissions and customer replies are visible in the admin Support inbox. Admin replies queue customer email notifications. Configure `SUPPORT_NOTIFICATION_EMAIL` to receive an operator alert for new submissions/customer replies; without it, admins must check the inbox. Support emails include the request subject and dashboard link, not the thread body.
- For read-only diagnosis, use aggregate-only queries such as `SELECT status, count(*) FROM mail_outbox GROUP BY status;` and `SELECT count(*) FROM mail_outbox WHERE status = 'PENDING' AND "nextAttemptAt" < now();`. Never include `payloadEnc`, addresses, OTPs, reset links, or support message contents in tickets. No external alert is configured for terminal mail failures; SMTP acceptance does not prove inbox delivery.

## Deployment and schema changes

- The Render API start command applies Prisma migrations before starting the API. Review every migration against a disposable staging database and representative old-account data before enabling that deploy path in production.
- Verify API readiness and worker heartbeat after a release; then exercise OAuth, Meta webhook intake, message delivery, token refresh, and both browser and signed-webhook payment activation with provider test accounts/sandboxes. Configure Razorpay's `payment.captured` webhook to `POST /api/payments/webhook` and store its webhook secret as `RAZORPAY_WEBHOOK_SECRET` in the deployment secret manager.
- No production deployment, migration, or rollback procedure was verified during this repository audit. Define a tested rollback strategy that accounts for forward-only schema changes before launch.

## Security incident: exposed credential

The repository history contains a previously exposed Redis credential. Treat it as compromised until the Redis provider confirms rotation. Rotate it through the provider, update deployment/local references using the approved secret manager, verify API and worker reconnect, then scan all reachable repository history and relevant logs without printing secret values. Source cleanup alone does not revoke a credential. Do not rewrite shared Git history without an owner-approved coordinated plan.

## Launch-critical procedures not yet established

- External alert routing and an on-call owner for API, worker, queue backlog, Meta token refresh, SMTP, and payments.
- Automated database backups, retention policy, restore credentials, and a successful restore drill.
- Razorpay periodic reconciliation, refunds, chargebacks, and payment support escalation; the webhook handles capture activation only. The current code grants one-time 30-day access.
- Incident response, customer notification, privacy/data-request escalation, and support response targets.
- Named service owners, provider support contacts, and exact production environment configuration.
