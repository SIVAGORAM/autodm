# Development roadmap

This roadmap is ordered around launch risk and creator trust, not implementation convenience. It reflects repository evidence; it does not assume market demand or revenue.

## Phase 1 — prove safe core delivery

1. Confirm the Redis credential exposed in all 13 reachable commits has been revoked at Upstash. The current ignored `.env` and `.env.bak` point to another Upstash database with a different credential, but this does not prove revocation of the old one. Run the redacted full-history secret scan in CI and review any remote repositories/logs before production use.
2. The development/testing Neon database has all 29 Nest migrations applied and Prisma validates the schema; 19 existing refresh-token rows were hashed in place. Six Super Admin/contact migrations were applied after fixing a missing nullable outbox relation column in the contact migration. Next, compare and test the migration history on staging and verify old-account compatibility before production. Do not use `db push --force-reset`.
3. Run a Meta test-user flow through OAuth, account-cap enforcement, webhook signature, comment/DM matching, retry, token refresh, disconnect, and plan expiry. Confirm only reviewed scopes and supported media types.
4. Complete Meta integration rollout: Unified Login code is now environment-gated and routes account operations by login mode; next implement dual-token migration/rollback for an existing account, define an expiring BISU token policy, configure the Meta app, obtain Advanced Access, and pass controlled Reel/webhook tests for both modes. Existing legacy integrations have no announced end date; new features ship only on Unified Login. See `META_LOGIN_MIGRATION.md`.
5. Exercise email verification/reset/trial reminders and Razorpay sandbox order/verification/refund scenarios. Verification users can now inspect queue/retry/SMTP-accepted/failure status; complete SMTP staging acceptance and add operator alerting for terminal failures. Define payment support/reconciliation procedures.
6. Validate the pinned Node 24.22.1 Render runtime; verify service environment references, one-hop proxy IP behavior, cold-start policy, persistent worker cost, auto-deploy and migration sequence.
7. Connect external monitoring to API readiness and the admin worker-health signal; add alerts for queue age/dead letters, token refresh failures, payments, SMTP, and service outages.

## Phase 2 — complete launch operations and trust

1. Replace the Terms/Privacy/Refund drafts with owner- and counsel-approved text; confirm legal entity, support/grievance contacts, subprocessors/regions, retention, and refund eligibility before setting legal policy status to `APPROVED`.
2. Verify export and staged account-deletion behavior against staging; define broader retention, backups, restore drills, incident response, access review, provider-side token revocation, and customer support/refund processes.
3. Complete dead-letter and `UNKNOWN` delivery operations with alerting, idempotency checks, and user-visible delivery guidance. The admin UI/API for webhook receipt redrive and an operator runbook now exist.
4. Validate follow-up run/quota lifecycle and automation-delete queue cancellation in staging; add safe operator redrive for failed/unknown deliveries only after duplicate-delivery safeguards are established.
5. Validate the implemented downgrade policy in staging: oldest active accounts retain plan slots, while automations on accounts outside the cap are skipped and marked plan-limited. Review reconnection behavior and ensure billing/help copy explains the policy.
6. Extend the isolated PostgreSQL/Redis CI smoke coverage: auth persistence/cookie/session/CSRF flows, immediate account-deletion tombstoning/session revocation, deletion-safe captured-payment handling against PostgreSQL with a mocked provider, and Razorpay webhook signature acceptance/rejection are now scripted, but the script has not yet run in GitHub Actions. Add other payment entitlement/race cases, quota concurrency, webhook-to-worker, ownership, account-link, and full deletion queue-drain integration coverage, then validate provider-dependent behavior in sandboxes.

## Phase 3 — improve creator activation and retention

1. Complete responsive and keyboard/screen-reader review across landing, auth, onboarding, automation builder, logs, and billing.
2. Build guided onboarding, account health, a controlled provider test-send workflow, clearer plan/usage warnings, and actionable provider-permission explanations. The local sample-recipient message preview is implemented in create/edit screens.
3. Improve analytics and creator outcome tracking before adding broad AI/CRM features.
4. Expand the basic contact inbox toward CRM only with validated user demand, consent and retention controls, segmentation/attribution needs, operational cost, and Meta policy fit. Evaluate AI intent, consent-based email capture, workspaces, and collaboration against the same criteria.

## Release gates

Do not call the product launch-ready until P0 items in `SECURITY_AND_LAUNCH.md` pass with recorded evidence. Do not advertise any feature marked planned, disabled, or provider-unverified in `FEATURE_INVENTORY.md`.
