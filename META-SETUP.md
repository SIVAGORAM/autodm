# Meta setup — complete beginner guide (AutoDM / Relayo)

Written assuming you know nothing about Meta's developer platform. Follow top to
bottom. Everything here is **free** — Meta does not charge for the API, App
Review, or Business Verification, and there is **no per-DM fee** on Instagram.

---

## Is it free? Yes.
| thing | cost |
| --- | --- |
| Meta developer account | Free |
| Creating a Meta app | Free |
| Instagram API (comments, DMs) | Free — no per-message charge |
| App Review | Free |
| Business Verification | Free (needs documents, not money) |
| What DOES cost money | Your hosting, domain, Razorpay fees — not Meta |

> WhatsApp Business API charges per conversation. You are NOT using that.
> Instagram DM automation via this API has no messaging fee.

---

## Before you start (prerequisites)
1. **An Instagram Professional account** (Business or Creator). In the Instagram
   app: Settings -> Account type -> switch to Professional. Personal accounts
   cannot use the API.
2. **A business identity** — even a sole proprietor / your freelance business is
   fine. Business Verification later may ask for a document (GST, utility bill,
   business registration, etc.).
3. **A live HTTPS domain** for your API (from deploy.md) — Meta needs real https
   URLs for the redirect and webhook. For first testing you can use a tunnel
   like ngrok.

---

## Glossary (Meta words you'll see)
- **App** — your project inside Meta's developer dashboard. Holds your keys and settings.
- **App ID / App Secret** — your app's username + password. Secret stays private.
- **Product** — a feature you add to the app (you add the "Instagram" product).
- **Permission / scope** — a specific thing your app may do (read comments, send DMs).
- **Standard Access** — default; works only for accounts you add as testers.
- **Advanced Access** — public use; unlocked by App Review + Business Verification.
- **Development / Live mode** — dev = only your testers; live = everyone.
- **App Review** — Meta checks your app before granting Advanced Access.
- **Business Verification** — Meta confirms your business is real (documents).
- **Webhook** — Meta calls your server when a comment/DM happens.
- **Tester** — an Instagram account you add so it can use the app before launch.

---

## Step by step

### 1. Create a developer account
- Go to developers.facebook.com -> log in with Facebook -> "Get Started".

### 2. Create the app
- My Apps -> Create App -> type **Business** -> name it (e.g. "Relayo").

### 3. Add the Instagram product
- App dashboard -> Add Product -> **Instagram** -> choose
  **"Instagram API with Instagram Login"** (the flow the code uses).

### 4. Get your keys  ->  put them in backend-nest/.env
- From the Instagram product settings, copy:
  - **Instagram App ID**  -> META_APP_ID
  - **Instagram App Secret** -> META_APP_SECRET
- WARNING: these are the **Instagram** ID/secret, different from the app's main
  Facebook App ID. Use the Instagram ones.

### 5. Set the OAuth redirect URI
- Instagram login settings -> Valid OAuth Redirect URIs -> add:
  https://<your-api-domain>/api/instagram/callback
- Local testing with ngrok: https://<your-ngrok>.ngrok.io/api/instagram/callback

### 6. Set up webhooks
- App -> Webhooks (or Instagram -> Webhooks):
  - Callback URL: https://<your-api-domain>/webhooks/instagram
  - Verify token: any string you choose — put the SAME string in META_WEBHOOK_VERIFY_TOKEN
  - Subscribe to fields: comments and messages
- Meta calls your URL to verify; your API already answers this handshake.

### 7. Required callback URLs (Meta needs these for any data-handling app)
- Deauthorize callback URL
- Data deletion request URL
- Privacy Policy URL (a public page — you need one anyway)
- App icon + app details

### 8. Add yourself as a tester (test NOW, before approval)
- App Roles -> Roles -> add your Instagram account as a tester, OR
- Instagram product -> add an Instagram Tester account and accept the invite in
  that account's Instagram settings.
- Your own account can now connect and test the full flow in Development mode.

### 9. Request the permissions (App Review) — Advanced Access on all three
- instagram_business_basic
- instagram_business_manage_messages
- instagram_business_manage_comments
- App Review -> Permissions and Features -> request Advanced Access on each.
- You record a screencast showing how your app uses each permission + a short
  use-case description. Meta reviews it (days to ~2 weeks).

### 10. Business Verification
- Meta Business Suite -> Settings -> Security Center -> Business Verification ->
  submit business details + a document. Free. Required for Advanced Access.

### 11. Go Live
- After approval + verification, flip the app from Development to **Live**. Any
  creator can connect, not just your testers.

---

## What maps to which .env value
| Meta thing | .env variable |
| --- | --- |
| Instagram App ID | META_APP_ID |
| Instagram App Secret | META_APP_SECRET |
| Verify token (you choose) | META_WEBHOOK_VERIFY_TOKEN |
| Graph API version (e.g. v21.0) | META_GRAPH_VERSION |
| Your API base URL | PUBLIC_URL |

## Now vs. needs-approval
- **Now (Development mode):** create the app, add your own IG account as tester,
  connect it, test the WHOLE flow end-to-end. No review needed for your own accounts.
- **Needs App Review + Business Verification:** letting OTHER creators connect
  (public launch). Start this early — longest lead time in the project.

## Common mistakes
- Using the Facebook App ID instead of the Instagram App ID -> OAuth fails.
- Redirect URI not EXACTLY matching (trailing slash, http vs https) -> OAuth fails.
- Testing with a personal Instagram account -> must be Professional.
- Forgetting to subscribe the webhook to BOTH comments and messages.
