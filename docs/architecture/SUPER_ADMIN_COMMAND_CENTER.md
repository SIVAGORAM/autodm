# HeyLaunch Super Admin Command Center

## Current implementation

The authenticated dashboard uses Next.js App Router at `frontend/app/(dashboard)` and a NestJS API at `backend-nest/src`. Admin routes live under `/api/admin`; all dashboard calls use the existing cookie-authenticated API client. The customer/admin APIs use persisted-role guards, not role claims from the access token.

### Shipped in this workspace

- `SUPER_ADMIN` role and append-only-by-application audit records: Prisma `UserRole` and `AdminAuditEvent` in `backend-nest/prisma/schema.prisma`.
- Super Admin team management: `GET/POST /api/admin/team`, `PATCH /api/admin/team/:userId/role`, `PATCH /api/admin/team/:userId/permissions`, `POST /api/admin/team/:userId/suspend`, and `POST /api/admin/team/:userId/reactivate`; an already registered and verified user is required. Standard admins have individually configurable support, contact, mail-read, and operations-read permissions; permissions are rechecked against PostgreSQL on each protected request. Existing admins retain their current scope on migration; newly promoted admins receive no operational permissions until a Super Admin grants them. Team changes are reasoned and audited. Last active Super Admin and self-change safeguards are present. Suspension revokes refresh sessions and clears an incomplete MFA challenge; reactivation requires a fresh MFA login.
- One-use administrator invitations: Super Admins can create, list, and revoke invitations through `/api/admin/team/invitations`. Invitees sign up or verify the exact invited email, then accept through `POST /api/admin/invitations/accept`. Tokens are random, stored only as SHA-256 hashes, sent in the encrypted durable mail outbox, expire after seven days, and are single-use. New invitees start with no permissions unless the inviter chooses initial grants. Acceptance elevates only a verified, active customer account to `ADMIN`, writes an audit record, revokes its sessions, and requires a fresh login followed by mandatory MFA enrollment.
- Mandatory administrator MFA: admin login first receives a five-minute, one-use HTTP-only challenge; existing administrators enroll an authenticator before normal sessions are issued. TOTP secrets are encrypted at rest, replayed time steps are rejected, and single-use recovery codes are stored only as keyed hashes. `DELETE /api/admin/team/:userId/mfa` lets an authenticated Super Admin reset another admin's factor with a reason, revoke sessions, and force re-enrollment. Admin guards and refresh rotation deny privileged sessions without current MFA.
- Customer directory/detail and account suspension/reactivation: `GET /api/admin/customers`, `GET /api/admin/customers/:id`, `POST /:id/suspend`, `POST /:id/reactivate`. Suspension revokes refresh sessions and pauses live automations; reactivation leaves them paused.
- Operations snapshot and paginated audit history: `GET /api/admin/command-center/overview`, `GET /api/admin/command-center/audit-events` (Super Admin only).
- Read-only billing ledger: `GET /api/admin/command-center/payments` (Super Admin only), with date/plan/currency/search filters, pagination, customer projection, and captured amount totals grouped by currency. It uses provider-verified `Payment` rows only and explicitly does not claim net revenue or provide refunds/subscription lifecycle data.
- Support/feedback inbox: `GET /api/admin/support-requests`, status updates and replies; admin status/reply actions now write metadata-only audit records in the same transaction. Reply notifications enter the durable mail outbox; queued is not equivalent to delivered.
- Public contact enquiry inbox: public `POST /api/contact/enquiries` stores submissions, the admin API supports list/search/status/priority/assignment/reply/internal notes, and replies use the durable encrypted mail outbox with per-message delivery status. Admin mutations are audited without placing message bodies into audit metadata. Notification emails go only to the configured `SUPPORT_NOTIFICATION_EMAIL` and omit visitor message content.
- Mail delivery status: `GET /api/admin/mail-outbox` (no arbitrary email composer or bulk sender).
- Webhook dead-letter review/redrive: `GET /api/admin/webhook-events/dead-letter`, `POST /api/admin/webhook-events/:id/redrive`; redrive is Super Admin-only, requires a reason, is transactional with an audit entry, and refuses unavailable, suspended, or deletion-locked accounts.
- Worker health: `GET /api/admin/health/worker`; Redis queue depth and a short-lived heartbeat are checked. The command center polls its snapshot every 30 seconds and labels unavailable checks honestly.

Frontend routes are `/dashboard/admin`, `/dashboard/admin/team`, `/dashboard/admin/customers`, `/dashboard/admin/customers/[id]`, `/dashboard/admin/billing`, `/dashboard/admin/support`, `/dashboard/admin/enquiries`, `/dashboard/admin/enquiries/[id]`, `/dashboard/admin/mail`, and `/dashboard/admin/webhooks`; the public enquiry form is `/contact`.

## Metric definitions and limits

The command center reads counts directly from Prisma/PostgreSQL and BullMQ/Redis. “Active customer” means a non-suspended influencer account without a pending deletion request; it does not imply recent product activity. Connected Instagram count means `IgAccount.isActive`, not a fresh Meta token validation. Failed runs, failed mail records, unprocessed webhook dead letters, and open/in-progress support requests are stored counts, not time-window rates. Worker health is based on a Redis heartbeat with a 45-second TTL; the page refreshes every 30 seconds. These checks are not external uptime monitoring or alert delivery.

Revenue is intentionally absent: `Payment` records captured payment identifiers and amounts but the repository has no refund/reversal ledger or subscription event history, so a revenue total could misstate net collections. Public contact submissions and customer-created support/feedback are stored separately. Contact form rate limiting uses the existing app-level throttler; distributed abuse prevention, inbound email ingestion, file attachments, and SLA timers are not implemented.

## Security boundaries

- `/team`, `/customers`, and `/command-center` require JWT, verified email, persisted Super Admin role, and enrolled MFA.
- Support, outbox visibility, webhook inspection, and worker health use persisted role, mandatory MFA, and the endpoint-specific permission for standard admins. Super Admin bypasses the permission list but not MFA. Webhook redrive still requires Super Admin.
- Customer lists return a constrained projection; customer detail does not select Instagram token ciphertext or message contents.
- Admin audit views return actor, action, target, reason, request ID, and timestamp, not `before`/`after` snapshots.
- Account deletion is customer-initiated and represented as pending. A full admin review/approval and scheduled deletion workflow is not implemented; this command center does not expose a hard-delete control.

## Important gaps before broad commercial operation

1. Reauthentication for sensitive actions and IP/device/session risk controls are not implemented. Permissions currently split standard admin access across support, contact enquiries, mail visibility, and operational health/dead-letter visibility. Customer controls, billing, command center, audit, team management, and webhook redrive remain Super Admin-only.
2. Invitation acceptance still depends on configured SMTP for delivery. Delivery being queued does not prove the email reached the invitee. One-time bootstrap is provided by `backend-nest/scripts/bootstrap-super-admin.cjs` and must be run deliberately by an operator.
3. Contact enquiries now support assignment, internal notes, and email replies; inbound email ingestion, attachments, and SLA timers remain missing.
4. The billing screen is a read-only ledger of provider-verified captures. Refund controls, payment failure ledger, revenue reconciliation, and subscription lifecycle history are missing. Do not add refunds until a provider-backed, idempotent and audited flow exists.
5. No alert routing, incidents, external uptime probes, error-rate/latency telemetry, or configurable thresholds. Unknown service state must remain unknown.
6. No admin feature-flag/configuration console, exports, customer account recovery initiation, or deletion approval workflow.
7. MFA and role granularity should precede adding more staff; audit history is currently metadata-only and is not protected against direct database edits by a database-level append-only policy.
8. Reel support remains a verification gate. Meta's current consolidated Webhooks setup and comment examples cover modern login modes and show a Reel media product type; the private-reply guide documents Reel comments and responses. The older Facebook Login-specific webhook page still says Reels are unsupported. A schema field alone does not prove delivery for a selected integration, and HeyLaunch has no authorized live Reel acceptance test yet.

## Database rollout

The Super Admin foundation migration is `backend-nest/prisma/migrations/20261122110000_super_admin_foundation/migration.sql`; customer lifecycle fields are in `20261122120000_admin_customer_lifecycle/migration.sql`; required MFA fields are in `20261122130000_admin_mfa/migration.sql`; public contact enquiries are in `20261122150000_public_contact_enquiries/migration.sql`; admin permission assignments are in `20261122170000_admin_permissions/migration.sql`; invitations are in `20261122180000_admin_invitations/migration.sql`. On 2026-11-22 these six additive migrations were applied to the operator-confirmed development/testing Neon database with `prisma migrate deploy`; Prisma then reported all 29 local migrations applied and schema valid. A missing `mail_outbox.contactEnquiryMessageId` column in the contact migration was found by read-only preflight and added before deployment. No production or staging database was changed. Do not use `prisma db push --force-reset`.

The development database currently has zero active admins and zero active Super Admins. The first owner account must be an existing, verified, active account and must be explicitly selected for the one-time bootstrap. Use `npm run admin:bootstrap-super-admin -- <verified-account-email> --confirm=CREATE_SUPER_ADMIN`; the script refuses an existing active Super Admin and rotates sessions. No account was promoted during this work because the owner identity was not specified.

## Next implementation order

1. Bootstrap the confirmed owner account, then exercise MFA enrollment, team invitation, permissions, customer suspension/reactivation, and audit visibility in the development dashboard.
2. Add fine-grained permissions, recovery procedures, and reauthentication for sensitive actions.
3. Complete admin audit coverage for every privileged write and add tamper-evident retention/export controls.
4. Build customer deletion review with legal retention gates and a separately approved two-person destructive action.
5. Add provider-backed billing reconciliation and subscription lifecycle records; the capture ledger does not provide these capabilities.
6. Add external health checks and alert delivery; do not label internal dependency probes as internet uptime.
7. Run staging browser, permission, concurrency, migration, recovery, and operational drills before production rollout.

## Meta configuration note

The local backend `.env` contains Meta app credentials and webhook verification configuration; secret values are intentionally not recorded here. Unified Login is disabled locally and requires the Meta dashboard configuration ID (`META_UNIFIED_LOGIN_CONFIG_ID`) plus `META_UNIFIED_LOGIN_ENABLED=true`. The Render blueprint declares it disabled until configured. Meta dashboard setup, Advanced Access/App Review, webhook field subscriptions, business verification, and authorized real-account tests are separate from environment variables. The local Graph version is `v21.0`; `render.yaml` uses `v26.0`, while current official docs show `v27.0`. Version changes require staging compatibility validation.
