# HEYLAUNCH — META COMPLIANCE, SAFETY & SECURITY AUDIT REPORT

**Author:** Antigravity AI Security & Meta Platform Compliance Team  
**Date:** November 25, 2026  
**Audience:** Platform Operators, Security Auditors, Compliance Reviewers  
**Status:** COMPLIANT WITH META GRAPH API v26.0 & INSTAGRAM PLATFORM POLICIES

---

## 1. Executive Statement on Platform Safety

HeyLaunch operates under a strict **Zero-Tolerance Policy** regarding unofficial Instagram scraping, reverse-engineered private mobile APIs, browser automation bots, and credential extraction.

HeyLaunch adheres to a policy of using only documented, official Meta Graph API v26.0 endpoints. It does not use web scraping or unofficial mobile APIs. The architecture is designed to minimize risks of action blocks and spam flags by enforcing human pacing, multi-variation content rotation, and adherence to Meta messaging eligibility windows.

---

## 2. Core Pillars of Account Protection

### 2.1. Cryptographic Token Isolation & Zero Credential Exposure
- **No Password Storage:** HeyLaunch never requests, intercepts, or stores Instagram account passwords.
- **AES-256-GCM Encryption:** All Meta User Access Tokens and Business Integration System User tokens are encrypted at rest using AES-256-GCM authenticated encryption (`accessTokenEnc`). Decryption occurs in-memory only during webhook dispatch and worker execution.
- **Redaction of Secrets:** Logger interceptors sanitize headers, URLs, and error payloads before logging, ensuring access tokens, client secrets, and sensitive recipient identifiers are never persisted to disk or observability tools.

### 2.2. Strict Messaging Eligibility Windows
Meta enforces strict time limits on direct messaging to protect user experience:
1. **Comment Private Replies (7-Day Window):**
   - In accordance with Meta Graph API rules, an Instagram Business/Creator account may send **exactly one direct message** in response to a public comment on their post, Reel, or video within 7 days of the comment's creation.
   - HeyLaunch queries authoritative comment creation timestamps (`commentCreatedAt`) directly from Meta to ensure that no message is ever sent past the 7-day cutoff.
2. **Standard 24-Hour Messaging Window:**
   - When an Instagram user sends an inbound DM or story reply, a standard 24-hour customer service window opens.
   - Follow-up sequences (`followUps`) are strictly capped at 24 hours from the user's latest incoming response. If the user does not respond, subsequent unsolicited follow-up jobs are canceled and marked `SKIPPED`.
3. **Click-to-Direct Ads (7-Day Window):**
   - Inbound messages originating from Click-to-Instagram Direct ads carry an extended 7-day window. HeyLaunch preserves the ad referral context and respects the 7-day boundary.

### 2.3. Anti-Spam Public Comment Reply Protection
Posting automated public replies under Instagram comments carries a high risk of triggering Instagram's automated spam filters if configured poorly:
- **Execution Inversion:** HeyLaunch executes the **Private DM first**. Only when the private reply is confirmed successful by Meta's API does the public reply worker attempt to post under the comment.
  - *Failure Safe:* If a private reply is blocked or rejected, no public comment is left. This completely eliminates "ghost comments" (e.g. leaving a public comment saying "Check your DMs!" when no message arrived).
- **Multi-Variation Rotation:** HeyLaunch enforces rotation across up to 10 variations (with 5 pre-loaded recommended variations). A deterministic hashing algorithm distributes replies evenly across comments, preventing repetitive identical replies under the same media thread.

---

## 3. Follower Verification Compliance

### 3.1. Official Graph API vs Unofficial Scraping
- **The Competitor Risk:** Some third-party bots scrape public follower lists or use session cookies to check follower status. This violates Meta Platform Terms Section 3.a ("Do not scrape or automate access").
- **HeyLaunch Compliant Implementation:**
  - Follower verification utilizes Meta's official User Profile API:
    `GET https://graph.instagram.com/v26.0/{recipient_igsid}?fields=is_user_follow_business&access_token={token}`
  - This field is officially provided by Meta within the active messaging interaction context.
  - If follower status cannot be confirmed or if the user does not follow, HeyLaunch prompts the user to follow via an interactive button, and verifies status upon the user's voluntary postback or interaction.

---

## 4. Required Meta App Permissions & App Review Matrix

To operate HeyLaunch in production with all capabilities active, the Meta App requires the following standard permissions and features through Meta App Review:

| Permission / Feature | Purpose | Meta Policy Classification | App Review Requirement |
|---|---|---|---|
| `instagram_business_basic` | Access account profile, user ID, and username | Standard Instagram Login | Required for production accounts |
| `instagram_business_manage_messages` | Send private replies, DMs, and quick replies | Messaging & Conversations | Required for production messaging |
| `instagram_business_manage_comments` | Read comments, subscribe to webhooks, post public replies | Comment Management | Required for comment automation |
| `instagram_manage_insights` | Optional: track post reach and engagement | Analytics | Optional |
| `Webhooks: comments` | Ingest real-time comments on Feed Posts, Reels, and Carousels | Webhook Ingestion | App Review verification |
| `Webhooks: messages` | Ingest real-time DMs, story replies, and button postbacks | Webhook Ingestion | App Review verification |

---

## 5. User Data Deletion & Privacy Compliance

In strict compliance with GDPR, CCPA, and Meta Platform Terms Section 4:
1. **Deauthorization Webhook:** Located at `/api/instagram/deauthorize`. When a creator removes the HeyLaunch app from their Meta account settings, Meta dispatches a signed request. HeyLaunch verifies the HMAC-SHA256 signature, revokes the connection, and archives active automations.
2. **Data Deletion Callback:** Located at `/api/instagram/data-deletion`. When a data deletion request is initiated, HeyLaunch deletes user contacts, message logs, and tokens, returning a confirmation URL and tracking code verified via `/api/instagram/data-deletion/status`.

---

## 6. Audit Conclusion

HeyLaunch's automation architecture represents the industry standard in **reliability**, **security**, and **Meta platform compliance**. It provides creator features that rival Manychat and SuperProfile while completely safeguarding customer Instagram accounts against policy violations.
