# Legal policy drafts — owner review required

The public Terms, Privacy, and Refund routes are working drafts, not legal advice or launch-approved documents. The owner supplied the brand/location as HeyLaunch, Hyderabad, Telangana, India, and asked for editable drafts. The registered legal entity name, monitored customer-support email, final refund window/eligibility, grievance officer/contact, retention periods, subprocessors, data locations, liability terms, and dispute wording are still placeholders.

## Before setting policy status to `APPROVED`

1. Replace every bracketed placeholder in `frontend/app/(legal)/terms/page.tsx`, `privacy/page.tsx`, and `refunds/page.tsx`. Confirm or change the 30-day default for unverified account deletion (`UNVERIFIED_ACCOUNT_RETENTION_DAYS`) so the notice matches the deployed setting.
2. Confirm the registered entity/operator and public service address; decide support and grievance contacts with monitored response commitments.
3. Verify the actual production subprocessor list and regions, including Neon, Render, Redis, SMTP, Meta, and Razorpay. Confirm cross-border data processing and retention/deletion behavior against each provider's configured region and terms.
4. Have India-qualified counsel review Terms, privacy notice and consent wording, consumer/e-commerce disclosures, refund handling, grievance process, age rules, and the DPDP Act/Rules implementation schedule.
5. Replace draft notices with approved text, update both backend and frontend policy version constants, and update the policy-page banner/version/date.
6. Verify signup stores the exact approved versions and timestamps, then change `LEGAL_POLICY_STATUS` and `NEXT_PUBLIC_LEGAL_POLICY_STATUS` from `DRAFT` to `APPROVED` together. Backend production signup fails closed unless the API status is `APPROVED`; the frontend also disables production signup while its status remains `DRAFT`.

## Official references checked

- The [Digital Personal Data Protection Act, 2023](https://www.indiacode.nic.in/indiacode/handle/123456789/22037?view_type=browse) has phased commencement under the [MeitY commencement notification G.S.R. 843(E), 13 November 2025](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf). The notification assigns different provisions to the publication date, one year later, and eighteen months later; the eighteen-month tranche falls on 13 May 2027. Confirm which provisions apply on the actual launch date rather than treating the Act as wholly effective or wholly deferred.
- The [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025%3B) were notified by [G.S.R. 846(E), 13 November 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf). Their commencement is also phased; the notice requires a clear, standalone notice describing the personal data and purposes for which it is processed. Counsel should verify current rules/corrigenda and operational requirements.
- The Ministry of Consumer Affairs publishes the [Consumer Protection (E-Commerce) Rules, 2020](https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules.pdf). Counsel should confirm their application to this subscription service, required seller/grievance disclosures, and refund wording, along with any amendments or later rules.

These references inform the review checklist only. They do not establish that HeyLaunch currently complies with Indian law.
