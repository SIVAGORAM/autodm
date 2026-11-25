# HEYLAUNCH — REAL INSTAGRAM INTEGRATION TEST PLAN

This document outlines the controlled, non-destructive verification protocol for staging environments before rolling out to general creators.

## Phase 1: Test Environment Setup

1. **Meta Developer App Roles:**
   - Add tester Instagram account (e.g. `@siva_kart2024` or `@comme_nt2dm`) as an **Instagram Tester** or **Developer/Tester** in Meta App Roles.
   - Accept invitation in Instagram Web / Mobile Settings → Apps and Websites → Tester Invitations.

2. **Webhook Tunneling / Endpoint Verification:**
   - Ensure webhook endpoint (`https://<domain>/webhooks/instagram`) responds with `hub.challenge` on `GET` and HMAC-SHA256 signature verification on `POST`.

---

## Phase 2: Live Integration Test Scenarios

### Test Case 1: Post Comment Trigger with Follow-First Gating
- **Action:** Tester account A (not following business) posts comment: `"send link"` on a test Reel/Post.
- **Expected Webhook:** Received in `WebhookController`, parsed, and queued in BullMQ.
- **Expected Private DM:** Delivery of message: *"Hey! Tap the button below to visit my profile and click Follow, then reply 'DONE'..."*
- **Expected Public Comment:** Posted under commenter's post with rotated reply variation (e.g., *"Sent! Check your DMs 📩"*).
- **Follower Resolution:** Tester clicks Follow, replies `"DONE"`.
- **Expected Final Delivery:** Main resource link and buttons delivered immediately.

### Test Case 2: Post Comment with Voluntary Email Capture
- **Action:** Tester posts comment with trigger keyword.
- **Expected Private DM:** *"Where should I send the resources? Please reply with your email address."*
- **Tester Action A (Valid Email):** Tester replies `"tester@example.com"`.
  - **Result:** Email saved in HeyLaunch Contacts, confirmation note logged, main link unlocked.
- **Tester Action B (Skip):** Tester replies `"SKIP"`.
  - **Result:** Link delivered immediately without saving an email.
- **Tester Action C (Invalid Input):** Tester replies `"not an email"`.
  - **Result:** Friendly recovery prompt asking for a valid email or `"SKIP"`.

### Test Case 3: Story Reply Trigger
- **Action:** Tester views creator's active Story and types: `"guide"`.
- **Expected Response:** Automated DM delivered within seconds with the requested guide resources.

### Test Case 4: Account Disconnection Verification
- **Action:** Click `Disconnect` in the HeyLaunch Instagram dashboard.
- **Expected UI:** Sleek modal dialog appears with warning list. Click `Disconnect account`.
- **Expected Result:** Account marked disconnected (`isActive: false`), token wiped.
- **Subsequent Comment Test:** Commenting on that account's posts generates zero DMs (safe drop).
