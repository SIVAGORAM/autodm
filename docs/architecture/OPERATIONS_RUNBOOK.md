# Operations runbook (pre-launch draft)

This runbook describes only operational controls verified in the repository. It is not evidence that production services, alerting, backups, or on-call ownership are configured. Before launch, assign named operators and provider-console access, test the procedures in staging, and add contact/escalation details.

## Service health

1. Check API liveness at `GET /health`. A successful response confirms only that the API process answers.
2. Check API readiness at `GET /ready`. A `503` means a required dependency is unavailable or Redis queue durability is not confirmed; inspect the individual `checks` fields and redacted API logs. Production requires `checks.redisQueuePolicy: ok` (`maxmemory_policy:noeviction`). If it reports `unsafe_or_unavailable`, disable Eviction for the Redis database in Upstash Console, then recheck readiness. The worker also refuses to start unless it can verify the policy.
3. A verified administrator can inspect `GET /api/admin/health/worker` or the dashboard's Webhook operations page. `status: stale` or `unavailable` means the worker heartbeat is missing/old or Redis could not be read. The endpoint also reports waiting, active, delayed, and failed queue counts.
4. If the worker is stale, inspect the worker service's platform status and redacted logs, verify its configured Redis/database environment references, and use the hosting provider's restart procedure. Recheck heartbeat and queue movement after recovery. Do not copy credentials into tickets or chat.

The API health endpoints and admin page do not send alerts. Until external monitoring is configured, an operator must perform these checks manually.

## Instagram provider connectivity

- `GET /api/instagram/accounts/:id/media` and webhook-subscription setup require outbound HTTPS from the API process to Meta Graph endpoints. A provider-network failure is returned as HTTP `503`; the automation builder displays a retryable network/proxy message.
- Meta requests explicitly disable Axios's generic `HTTP_PROXY`, `HTTPS_PROXY`, and `ALL_PROXY` discovery. Check direct outbound HTTPS from the API service first; `/ready` does not check Meta connectivity.
- If the hosting network requires an outbound proxy, configure the optional `META_HTTPS_PROXY` origin in the API service's secret environment. The Render Blueprint passes that value to the worker as well. Use an approved reachable HTTP(S) proxy with no URL path, query, or fragment, then restart affected services and retry. Do not copy proxy credentials into tickets or chat.
- Meta media loading and account webhook subscription are separate operations. A connected account with an unconfirmed webhook subscription cannot reliably trigger automations; use the dashboard's setup action only after outbound connectivity is working, then confirm receipt of a controlled staging event before enabling customer automations.

## Instagram OAuth connection failures

- Use the authenticated dashboard's `GET /api/instagram/login-options` response to confirm the deployed login mode, public App IDs, configuration ID, and exact redirect URI. Never include `state`, authorization codes, or tokens in a support ticket.
- For `INSTAGRAM_LOGIN`, the authorization URL must start at `https://www.instagram.com/oauth/authorize`; this code requests the Instagram Business Login permissions and exchanges the code using the Instagram product credentials (`INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`, falling back to `META_APP_ID`/`META_APP_SECRET` only for older deployments). Confirm the Instagram Login product is configured for that same app.
- For `UNIFIED_LOGIN`, the URL starts at `https://www.facebook.com/dialog/oauth` and includes a Business Login configuration ID. Confirm the App ID, App Secret, configuration ID, products, and permissions belong to the same Meta app. Do not infer that a Facebook-hosted intermediate OIDC page means Unified Login was configured correctly.
- For either flow, Meta's registered redirect URI must exactly match the dashboard value, including scheme, host, path, and trailing-slash behavior. The callback host must match the frontend origin that started OAuth so the browser can return the state cookie through the same-origin `/api` proxy. Prefer a stable frontend domain for production; preview domains require matching callback/CORS configuration and may change.
- The callback logs only a failure stage, safe exception class, and bounded Meta error category/code. A generic provider error page before callback may leave no callback log. If Meta supplies `error`, `error_code`, or `error_subcode`, capture those fields only; redact `state`, `code`, and all token values. If there is no callback entry, inspect the generated authorization URL and Meta app/configuration pairing before investigating session cookies.
- Cookie roles are intentionally separate: `access_token` is the short-lived HeyLaunch session cookie (`Path=/`); `refresh_token` is the rotated HeyLaunch session cookie (`Path=/api/auth`) and is not sent to Instagram routes; `ig_oauth_state` is a ten-minute HttpOnly, SameSite=Lax browser-binding cookie scoped to `/api/instagram/callback`, then cleared by the callback. Meta/Instagram account access tokens are encrypted in the database after a successful callback, not stored as browser cookies. Do not loosen cookie paths or SameSite settings as an OAuth workaround.

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
