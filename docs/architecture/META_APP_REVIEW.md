# Meta App Review and Instagram acceptance checklist

Status checked 2026-11-22. This is a preparation checklist, not a claim that Meta has approved the app or that provider behavior has passed acceptance. Do not put test credentials, access tokens, or private customer information in this document.

## Current HeyLaunch implementation

- Legacy Instagram Login remains the default. It requests `instagram_business_basic`, `instagram_business_manage_comments`, and `instagram_business_manage_messages`, exchanges and refreshes Instagram User tokens, and stores encrypted tokens.
- Unified Login is implemented behind `META_UNIFIED_LOGIN_ENABLED=false` by default. Its login URL uses the owner-provided `META_UNIFIED_LOGIN_CONFIG_ID`; OAuth state is signed, short lived, and bound to an HTTP-only browser cookie. The server exchanges the code and stores encrypted Business Integration System User tokens with the business/configuration metadata.
- Unified grants may return multiple Instagram professional accounts. The callback rejects malformed, duplicate, or truncated account lists, checks account ownership and the plan cap, persists the grant atomically, and attempts webhook subscription for each account.
- Both login modes subscribe each connected professional account to the `comments` and `messages` webhook fields. The callback is `PUBLIC_URL/api/instagram/callback`; the webhook endpoint is `PUBLIC_URL/webhooks/instagram`.
- The app handles comment private replies through the comment ID and follow-up messaging only after an eligible user response. It does not send arbitrary outbound promotional messages.
- A private Reel comment/reply path is documented by current Meta documentation, but HeyLaunch has not passed a controlled live Reel event and message test. Do not state that provider delivery is verified until that test succeeds.

Evidence in source: `backend-nest/src/instagram/instagram.service.ts`, `backend-nest/src/instagram/instagram.controller.ts`, `backend-nest/src/webhook/webhook.controller.ts`, `backend-nest/src/webhook/webhook.service.ts`, `backend-nest/src/queue/dm-processor.service.ts`, and `backend-nest/src/meta/meta.service.ts`.

## Permission request matrix

Request only scopes required by the selected login setup and features being submitted. Confirm the exact final permission names and access level in Meta App Dashboard before submission.

| Login setup | Permission | HeyLaunch use | Current state |
| --- | --- | --- | --- |
| Instagram Login | `instagram_business_basic` | Identify the professional account and read its eligible media | Requested by current legacy flow; App Review status unverified |
| Instagram Login | `instagram_business_manage_comments` | Receive/manage comment events and use comment IDs for private replies | Requested by current legacy flow; Advanced Access unverified |
| Instagram Login | `instagram_business_manage_messages` | Send permitted private replies and eligible follow-up messages | Requested by current legacy flow; Advanced Access unverified |
| Unified Login | `instagram_basic` | Read assigned Instagram account IDs and usernames | Must be present in the configured Meta login configuration; unverified in Dashboard |
| Unified Login | `instagram_manage_comments` | Subscribe to comment webhooks and support comment private replies | Must be present in the configured Meta login configuration; Advanced Access unverified |
| Unified Login | `instagram_manage_messages` | Subscribe to message webhooks and send permitted private replies/follow-ups | Must be present in the configured Meta login configuration; Advanced Access unverified |

Do not request `ads_read`, `ads_management`, publishing, insights, `business_management`, or other scopes unless a specific approved product feature needs them. The opt-in BISU expiry refresh uses Meta's documented `fb_exchange_token` endpoint and app credentials; it does not use the separate token-generation API that requires `business_management`. Keep `META_UNIFIED_TOKEN_REFRESH_ENABLED=false` until staging verifies it. Meta says token expiration depends on the configuration and access stops if a client removes the app or moves the account to another portfolio.

## Meta Dashboard and business-owner actions

1. Verify the app is owned by the correct business portfolio and has the Instagram messaging/content use case required for Unified Login.
2. Confirm the supplied Configuration ID, requested assets, selected access token type/expiration, required permissions, and exact HTTPS redirect URL. The redirect URL must equal the deployed API's `PUBLIC_URL` plus `/api/instagram/callback`.
3. Configure the Instagram Webhooks callback as the deployed API URL plus `/webhooks/instagram`, and set the matching verify token in the Dashboard and server environment. Never paste the token in review notes.
4. Subscribe to the fields actually used by the selected setup. Confirm `comments` and `messages` are selected at the app level and that every connected account receives the expected account-level `/subscribed_apps` subscription.
5. Complete Business Verification and request Advanced Access as required for production client accounts and webhook delivery.
6. Configure public Privacy Policy, Terms, and data-deletion instructions. Verify the Meta deauthorization and data-deletion callback URLs against the live API route and run their acceptance tests in a non-production app.
7. Keep Unified Login disabled in production until configuration and acceptance are complete. Do not migrate existing accounts or invalidate legacy tokens as part of App Review preparation.

Current Meta documentation: [Unified Login setup](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started), [Unified Login permissions](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions), [webhook setup](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup), [webhook fields](https://developers.facebook.com/documentation/instagram-platform/webhooks/fields), [private replies](https://developers.facebook.com/documentation/instagram-platform/private-replies), [App Review](https://developers.facebook.com/docs/resp-plat-initiatives/app-review/introduction).

## Reviewer walkthrough draft

Replace each bracketed item with approved, working, non-customer test access before submitting. Do not submit while any step is unavailable.

1. Open `[public production or reviewer test URL]` and sign in with `[reviewer test account instructions]`.
2. From the Instagram connections page, select the login setup under review and follow the Meta authorization flow with `[authorized test professional account]`.
3. Show the requested account selection and explain the purpose of each permission in the consent flow.
4. Create an automation for a selected public test post or Reel using the keyword `[review keyword]` and a short, policy-compliant private reply.
5. From a separate authorized test user, add a new comment containing the keyword. Show the comment event arriving, the matched automation, and the resulting private reply in the recipient inbox/request folder.
6. Show the delivery log and how duplicate events are deduplicated. Demonstrate that an expired/revoked permission is surfaced as a reconnect action rather than repeatedly retried.
7. Show how a creator pauses/deletes the automation and disconnects the account. Explain the account-deletion and data-deletion paths.

The reviewer account, professional account, media, comment, and messages above do not yet exist as a verified submission fixture. Record an end-to-end screen capture only after the controlled test passes. Do not use real customers or real customer messages for the recording.

## Controlled staging acceptance matrix

| Scenario | Evidence to retain | Status |
| --- | --- | --- |
| Each login setup: OAuth, consent, state/cookie binding, code exchange, account discovery | Redacted trace, selected account IDs, granted scopes and login mode | Pending authorized staging test |
| Multiple account grant, duplicate grant, plan-cap overflow, cross-owner collision | Test result showing all-or-none persistence and clear error | Unit tested; Meta grant acceptance pending |
| `comments` / `messages` app fields and per-account subscriptions | Dashboard field state and successful subscription response (redacted) | Pending Dashboard/staging verification |
| New photo/carousel comment event and DM | Sanitized event shape and provider message ID/status | Pending provider acceptance |
| New Reel comment event and private reply | Sanitized Reel event, event/media identifiers and provider result | Pending provider acceptance |
| Duplicate event and retry | Duplicate receipt/queue behavior and no duplicate message | Unit tested; provider event pending |
| Expired/revoked token, rate-limit response and recovery | Redacted logs, reconnect state and retry/dead-letter status | Unit tested in parts; provider acceptance pending |
| Deauthorization, data deletion, disconnect | Callback response, queue drain and confirmed deletion scope | Unit tested in parts; Dashboard/staging acceptance pending |

The repository includes unit tests for OAuth, token routing, webhook parsing, matching, delivery, retry, and account lifecycle. Those tests mock Meta and do not substitute for any pending staging test above. Never send actual messages outside the authorized test accounts.
