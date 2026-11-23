# Development roadmap

This roadmap is ordered around launch risk and creator trust, not implementation convenience. It reflects repository evidence; it does not assume market demand or revenue.

## Phase 1 — prove safe core delivery

1. Confirm the historical Redis credential has been revoked at Upstash. In the current full-depth checkout, one of two reachable historical `test-redis.js` versions contains a credential-bearing Redis URL; the current tracked script reads `REDIS_URL` from the environment. `.github/workflows/secret-scan.yml` already runs a redacted Gitleaks scan over checked-out files and all reachable Git history on pushes, pull requests, manual dispatch, and weekly schedule; no hosted run result was available in this review. This local history check does not cover remote-only refs, repository copies, logs, or forks. Review the successful hosted scan and provider logs, revoke the historical credential if not already done, and confirm remote/fork cleanup before production use.
2. The configured development/testing Neon database last reported all 30 Nest migrations applied and 19 existing refresh-token rows hashed in place. The current migration directory contains 30 migrations, but a fresh `migrate status` attempt on 2026-11-23 failed to start the Prisma schema engine. A guarded direct PostgreSQL read-only check against the confirmed pooled endpoint also failed DNS resolution (`ENOTFOUND`) before issuing any query, so the remote state remains unconfirmed; no database data was read or changed in that attempt. Six Super Admin/contact migrations were applied after fixing a missing nullable outbox relation column; a later admin-audit immutability migration brought the chain to 30. Compare and test the migration history on staging and verify old-account compatibility before production. Do not use `db push --force-reset`.
3. Run a Meta test-user flow through OAuth, account-cap enforcement, webhook signature, comment/DM matching, retry, token refresh, disconnect, and plan expiry. Confirm only reviewed scopes and supported media types.
4. Complete Meta integration rollout: Unified Login and opt-in 60-day BISU token refresh code are implemented behind environment flags; refresh has not been tested against an authorized Meta staging account and stays disabled by default. Next validate the exact Meta app/configuration, complete Advanced Access, and pass controlled OAuth, expiry, Reel/webhook, and private-reply tests. Cross-mode dual-token migration/rollback remains outstanding. Existing legacy integrations have no announced end date. See `META_LOGIN_MIGRATION.md`.
5. Exercise email verification/reset/trial reminders and Razorpay sandbox order/verification/refund scenarios. Verification users can now inspect queue/retry/SMTP-accepted/failure status; complete SMTP staging acceptance and add operator alerting for terminal failures. Define payment support/reconciliation procedures.
6. Validate the pinned Node 24.22.1 Render runtime; verify service environment references, one-hop proxy IP behavior, cold-start policy, persistent worker cost, auto-deploy and migration sequence.
7. Connect external monitoring to API readiness and the admin worker-health signal; add alerts for queue age/dead letters, token refresh failures, payments, SMTP, and service outages.

## Phase 2 — complete launch operations and trust

1. Replace the Terms/Privacy/Refund drafts with owner- and counsel-approved text; confirm legal entity, support/grievance contacts, subprocessors/regions, retention, and refund eligibility before setting legal policy status to `APPROVED`.
2. Verify export and staged account-deletion behavior against staging; define broader retention, backups, restore drills, incident response, access review, provider-side token revocation, and customer support/refund processes.
3. Complete dead-letter and `UNKNOWN` delivery operations with alerting, idempotency checks, and user-visible delivery guidance. The admin UI/API for webhook receipt redrive and an operator runbook now exist.
4. Validate follow-up run/quota lifecycle and automation-delete queue cancellation in staging; add safe operator redrive for failed/unknown deliveries only after duplicate-delivery safeguards are established.
5. Validate the implemented downgrade policy in staging: oldest active accounts retain plan slots, while automations on accounts outside the cap are skipped and marked plan-limited. Review reconnection behavior and ensure billing/help copy explains the policy.
6. Extend isolated PostgreSQL/Redis CI smoke coverage. The current `.github/workflows/ci.yml` applies migrations to disposable PostgreSQL, starts PostgreSQL and Redis services, and runs the audit immutability, auth/payment, dashboard-event, and Redis throttler smoke scripts. The auth smoke now checks cookie flags, paths, and lifetimes as well as persistence/session/CSRF behavior. These checks are wired into CI; no hosted GitHub Actions result was available in this review. Add other payment entitlement/race cases, quota concurrency, webhook-to-worker, ownership, account-link, and full deletion queue-drain integration coverage, then validate provider-dependent behavior in sandboxes.

## Phase 3 — improve creator activation and retention

1. Complete responsive and keyboard/screen-reader review across landing, auth, onboarding, automation builder, logs, and billing.
2. Complete guided onboarding, account health, a controlled provider test-send workflow, clearer plan/usage warnings, and actionable provider-permission explanations. Account health is partial: Instagram shows webhook status and near-expiry token warnings with a reconnect action where supported; worker health is visible to verified admins. The local sample-recipient message preview is implemented in create/edit screens.
3. Improve analytics and creator outcome tracking before adding broad AI/CRM features.
4. Expand the basic contact inbox toward CRM only with validated user demand, consent and retention controls, segmentation/attribution needs, operational cost, and Meta policy fit. Evaluate AI intent, consent-based email capture, workspaces, and collaboration against the same criteria.

## Release gates

Do not call the product launch-ready until P0 items in `SECURITY_AND_LAUNCH.md` pass with recorded evidence. Do not advertise any feature marked planned, disabled, or provider-unverified in `FEATURE_INVENTORY.md`.
