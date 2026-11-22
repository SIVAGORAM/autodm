# Razorpay merchant and payment release checklist

Status checked 2026-11-22. This document describes current repository behavior and launch work. It is not a merchant approval, legal opinion, or proof of a successful Razorpay transaction.

## Current integration behavior

- The public plan catalogue is generated from `backend-nest/src/common/plan.config.ts`. A paid purchase is a one-time INR order for the listed plan amount.
- The backend creates Razorpay orders with server-controlled amount, currency, plan, and user metadata. The frontend receives the order ID and publishable key ID, then invokes checkout.
- The verification endpoint checks Razorpay's checkout HMAC using a constant-time comparison, fetches the order and payment from Razorpay, and confirms plan amount, INR currency, order linkage, and captured status before applying access.
- The webhook validates the signature over the raw request body, ignores authenticated event types it does not process, fetches provider order/payment state before granting entitlements, and applies a capture idempotently by order/payment ID.
- A successful purchase grants 30 days. Purchases do not auto-renew. Re-purchasing the same or a higher paid plan extends from the current expiry. A lower-plan purchase during an active higher plan is rejected.
- A delayed verified capture for a deleting or deleted user is recorded without restoring entitlements.
- Production order creation fails closed while `LEGAL_POLICY_STATUS` is `DRAFT`.
- The Super Admin billing page is a read-only ledger of verified captures. Refund controls, chargeback tracking, reconciliation workflow, recurring billing, and cancellation controls are not implemented.

Evidence: `backend-nest/src/payments/payments.service.ts`, `backend-nest/src/payments/payments.controller.ts`, `backend-nest/src/payments/payments.dto.ts`, `backend-nest/src/common/plan.config.ts`, `backend-nest/src/admin/admin-operations.service.ts`, and `frontend/app/(dashboard)/dashboard/billing/page.tsx`.

## Merchant approval preparation

Razorpay's merchant terms allow review of the merchant website/app and require the offering to align with the approved business profile, applicable policies, pricing, refund/cancellation terms, and contact details. The merchant's exact KYC and activation requirements depend on the business type and account status. Confirm current requirements in the owner Dashboard rather than inferring approval from a successful API test. [Razorpay merchant terms](https://razorpay.com/terms/), [Razorpay India onboarding overview](https://razorpay.com/blog/minimum-documents-payment-gateway-onboarding-india/).

Before requesting live activation, the owner should verify:

- The Razorpay account's legal business type, registered/trading name, KYC documents, authorized representative, settlement bank account, and any tax details requested in the Dashboard.
- The live product URL and support/contact details are correct and reachable.
- The site describes HeyLaunch as creator-focused Instagram comment automation, states supported account/content limitations accurately, and displays current INR plan prices and 30-day purchase terms.
- Public Terms, Privacy, Refund/Cancellation, and Contact pages have final owner-approved content and legal review. The current legal routes are draft and production signup/checkout remain gated.
- The product description, plan amounts, refund policy, and support details match the merchant application and how the product actually works.
- Support staff know how to identify a payment by Razorpay order/payment ID without exposing payment credentials or customer tokens.

## Test-mode acceptance before live keys

Use a Razorpay test account and synthetic customer. Keep test credentials separate from production. Do not copy live keys into local/test configuration or switch live processing on during this checklist.

| Test | Expected behavior | Status |
| --- | --- | --- |
| Create order for each paid tier | Server-selected amount, INR, correct plan notes; no client-supplied amount | Unit tested; sandbox checkout pending |
| Successful captured payment | Provider order/payment are fetched and validated; grants exactly 30 days | Unit tested; sandbox checkout pending |
| Invalid signature / unpaid / wrong currency / mismatched amount or order | No entitlement; safe error | Unit coverage exists; full sandbox cases pending |
| Duplicate verify/webhook and concurrent capture | One payment row and one entitlement extension | Unit tests cover idempotency/race cases; sandbox replay pending |
| Delayed capture after account deletion begins | Payment receipt may be retained, but plan is not restored | Unit and CI smoke coverage; isolated sandbox acceptance pending |
| Higher-tier purchase while paid plan active | Upgrade follows the product's one-time extension rule | Code/unit coverage; sandbox acceptance pending |
| Refund initiated in Razorpay | Customer support and ledger state reconcile to provider | **Not implemented**; release gate before accepting live purchases |
| Provider outage or webhook delivery failure | Clear recovery path, alerts, and reconciliation without duplicate grants | Partial safe errors/retries; operational acceptance pending |

The backend test suite passed 67 suites / 419 tests on 2026-11-22, including payment signature, entitlement, retry/idempotency, and deletion-lock cases. This does not prove Razorpay sandbox acceptance or settlement/reconciliation.

## Production activation gates

1. Confirm final public prices, non-renewing 30-day terms, cancellation/refund policy, support channel, and legally approved policy versions.
2. Run the full sandbox flow against isolated test keys, including duplicate webhook delivery and provider fetch failure.
3. Implement and test provider-backed refund processing and a reconciliation procedure before accepting live payments. Admin payment history is currently read-only.
4. Configure webhook URL, raw-body signature verification, and secret in the Razorpay Dashboard; send test events and verify HTTP status/ledger result.
5. Confirm environment-variable names/availability in the production host without printing values; ensure test and live keys are not mixed.
6. Get merchant activation and live-mode access from Razorpay; record who is authorized to enable live mode.
7. Start with a controlled owner transaction only after the owner explicitly authorizes live mode and accepts the financial side effect. Reconcile the payment and refund it if appropriate.

No Razorpay test/live payment or merchant action was performed by this audit. Do not enable live keys or announce approved payments until the gates above pass.
