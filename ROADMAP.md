# HeyLaunch product roadmap

This roadmap reflects the current repository implementation as inspected on 2026-11-22. “Implemented” means code exists in the active Next.js/NestJS application; provider behavior and production operation are separate acceptance gates. See [Security and launch readiness](docs/architecture/SECURITY_AND_LAUNCH.md) for evidence, staging requirements, and production blockers.

## Delivered in the active codebase

- **Instagram automation core:** professional-account connection, post-comment rules, keyword/any matching, public comment replies, text and button DMs, per-plan limits, durable webhook receipts, BullMQ workers, delivery logs, retry/recovery states, and account-scoped private-reply pacing. Creating or activating comment, Story-reply, and incoming-DM automations requires a confirmed account webhook subscription; an unconfirmed subscription marks live rules as needing setup. Reel media can be selected and validated as video; actual Meta Reel webhook delivery and private-reply delivery are **not externally verified**.
- **Additional triggers:** Instagram incoming DM and Story-reply automation are represented in the editor and webhook worker. Their account eligibility, Meta App Review, and live provider behavior still need staging acceptance.
- **Follow-ups and personalization:** conditional follow-ups with quota reservations and delivery outcomes; supported template tags include name, first name, and username. Purchase/form conditions are not offered for new rules because HeyLaunch has no event integration for them; existing legacy steps are called out in the editor and cannot be newly added through the API.
- **Creator contacts:** paginated/searchable contacts, notes, tags, account filtering, and CSV export.
- **Public creator profiles:** unique handles, public profile pages, social/custom links, visibility controls, appearance, Cloudinary-backed avatars, and favicon resolution are present in the frontend/backend. Validate image privacy settings and full browser behavior with configured staging storage before launch.
- **Account and operator workflows:** account data export/deletion, support and contact inboxes, admin invitations/permissions, Super Admin controls, MFA, operational summaries, and webhook dead-letter review/redrive are present.
- **Billing foundation:** Razorpay order/payment verification and webhook idempotency grant one-time 30-day plan access. This is not recurring billing; refund/chargeback handling and provider reconciliation remain open.
- **Operations foundation:** environment validation, health/readiness probes, worker heartbeat, CI checks, migration deployment, and Render API/worker/frontend definitions exist. Current Render API/frontend plans are staging-only.

## Launch gates — complete before public paid launch

1. **Run staging acceptance against disposable/staging services.** Apply the reviewed migration set to staging; exercise sign-up, email verification, Instagram connect/reconnect, comment-to-private-reply, eligible Reel and Story paths, idempotency, worker recovery, account deletion, Razorpay sandbox payment/webhook, and email delivery. Do not use production accounts for this gate.
2. **Complete Meta approval and provider setup.** Configure approved OAuth redirect and webhook URLs/fields/permissions, obtain required Advanced Access, and verify account-level subscriptions and real test events. Keep Unified Login disabled until its controlled acceptance passes.
3. **Approve legal and billing terms.** Replace draft policy placeholders, verify retention/disclosures and support contacts with qualified counsel, test and document refund/chargeback operations, and retain the explicit one-time 30-day pricing description unless recurring billing is later implemented.
4. **Prepare production operations.** Use always-on API, frontend, and worker capacity; configure provider credentials in the hosting dashboard; set up monitoring/alerts for API, queue, worker heartbeat, dead letters, email outbox, and payment events; assign incident and support owners.
5. **Prove recovery and data handling.** Configure database backups, perform a restore drill, define retention for customer data and audit records, confirm Meta token revocation/deletion behavior, and review incident-response procedures.
6. **Close the historical credential exposure review.** Verify the old Redis credential is revoked and run the full-history secret scan. The current Redis smoke only proves the configured endpoint answered `PING`; it does not prove historical credentials are invalid.
7. **Complete product QA.** Test authenticated dashboard flows and public profiles in a real browser across mobile/tablet/desktop, verify keyboard/accessibility behavior, and validate avatar upload/deletion and public-profile privacy with staging Cloudinary settings.

## Product work after launch gates

Prioritize work from customer evidence and the core reliability wedge:

- Safe automation test-send flow with an explicit test recipient and delivery safeguards.
- More useful, privacy-conscious analytics and profile/link attribution.
- Consent-aware email capture and export/integration workflows.
- AI intent matching only after provider, cost, latency, abuse, and fallback behavior are specified and tested.
- Google sign-in only if creator onboarding research justifies the additional identity-provider surface.
- Rich media DM blocks and additional social integrations only after Meta capability, plan economics, and support burden are validated.
- Agency workspaces/team seats, public API, and other channels after the core Instagram path is reliable and paid-customer demand supports them.

## Explicitly not shipped or not verified

- Recurring subscription billing, automated renewal/cancellation, tested refund/chargeback handling, and periodic provider reconciliation.
- AI intent classification, email capture/ESP sync, Google sign-in, rich media DM blocks, multi-client workspaces/team collaboration, and advanced conversion analytics.
- Live Meta App Review/Advanced Access outcome, provider-side Reel delivery, production hosting/provider configuration, staging acceptance, backup restore, and public browser acceptance.

Do not market items in this section as currently available. The active backend is `backend-nest/`; `backend/` is the legacy Express implementation and is not referenced by the current Render Blueprint, Docker Compose stack, or CI workflow.
