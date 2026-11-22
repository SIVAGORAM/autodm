# Legal policy completion inputs

**Status: launch blocker.** These notes are an engineering evidence pack, not legal advice or approved customer-facing terms. Do not publish policy copy until the operator has supplied the missing business decisions and qualified counsel has reviewed applicability and wording.

## Product facts verified in the repository

- HeyLaunch is a hosted creator automation service for connecting Instagram professional accounts, configuring comment/message automations, and reviewing recorded activity. The landing page describes its present scope in `frontend/app/page.tsx`.
- Public pricing and the backend catalogue are denominated in INR. Paid plans are one-time 30-day access grants, with no recurring charge or automatic renewal (`backend-nest/src/common/plan.config.ts`, `backend-nest/src/payments/payments.service.ts`).
- Checkout uses Razorpay. The application verifies order/payment state and stores order/payment IDs, plan, amount, currency, and timestamp; it does not store card or bank account numbers (`backend-nest/src/payments/payments.service.ts`, `backend-nest/prisma/schema.prisma`).
- Accounts store name, email, password hash, verification/reset state, plan state, and refresh-token records. The application now stores SHA-256 digests for refresh tokens; a migration is required to convert existing database rows. Instagram access tokens are encrypted at rest (`backend-nest/prisma/schema.prisma`, `backend-nest/src/common/encryption.service.ts`).
- Connecting Instagram stores account IDs/usernames, an optional Page ID, token expiry, and encrypted provider token. Automation configuration includes trigger/matching settings, message blocks, and follow-ups. Incoming event processing can store Instagram-scoped IDs, usernames, event IDs, run outcomes, click events, and temporary webhook payloads.
- The contact model has an email field, but no email capture flow is implemented. Do not say the service currently collects a contact's email through automation.
- In-app support and feedback records store subjects, optional ratings, and customer/admin message bodies. Support email notifications contain the subject and a link, not message bodies.
- Account export is implemented. Account deletion tombstones/locks the account immediately, then schedules purge after a 15-minute grace period and queue drain. Payment rows are detached and retained; queue/migration behavior is not staging-verified (`backend-nest/src/users/users.service.ts`).
- Dead-letter webhook payloads are configured for 1–365 days of retention (default 30); terminal mail-outbox rows are purged after 30 days. A general retention schedule for the other account/activity data is not implemented.
- Deployment uses a Render blueprint; PostgreSQL, Redis, SMTP, Meta, and Razorpay are configured externally. Actual production providers, processing locations, subprocessors, and cross-border transfers are not established by the repository alone.

## Decisions required from the product operator

Fill these with actual business details; do not infer them from the brand or hosting account.

| Required input | Value to provide |
|---|---|
| Legal operator name and business type | `[required]` |
| Registered/principal business address and country | `[required]` |
| Public privacy, legal, billing, and support email addresses | `[required]` |
| Grievance/contact officer and response address, if applicable | `[required; counsel to confirm applicability]` |
| Intended customer countries and age eligibility | `[required]` |
| Governing law, courts, dispute process | `[counsel/operator decision]` |
| Applicable tax/GST status and invoice details | `[operator/accountant decision]` |
| Refund/cancellation policy for partially used or failed 30-day access | `[operator decision; counsel review]` |
| Data retention periods by category, including support and activity history | `[operator decision; counsel review]` |
| Current production subprocessors, locations, and transfer arrangements | `[verify deployment/vendor accounts]` |
| Meta/Razorpay required notices and user responsibilities | `[counsel/provider terms review]` |
| Policy effective date, versioning and change-notice approach | `[required]` |

## Review references

- India's [Digital Personal Data Protection Act, 2023](https://www.indiacode.nic.in/indiacode/handle/123456789/22037?view_type=browse) and MeitY's [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025) have staggered commencement provisions; confirm the provisions in force on the launch date with counsel.
- The Department of Consumer Affairs publishes the [Consumer Protection (E-Commerce) Rules, 2020](https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules.pdf) and [2021 amendment](https://consumeraffairs.nic.in/sites/default/files/Consumer%20Protection%20%28E-Commerce%29%20%28Amendment%29%20Rules%2C%202021.pdf). Counsel should determine how they apply to the product/operator and required disclosures.

## Publication gate

Before changing the landing footer from placeholders to published policies:

1. Complete all operator decisions above.
2. Confirm product facts against the production environment and provider accounts.
3. Obtain legal review of privacy, terms, refunds, and consumer complaint handling for every target market.
4. Implement the resulting retention, consent, refund, and contact workflows where the policies promise them.
5. Replace the footer placeholders only after the reviewed policies are approved and actually published.
