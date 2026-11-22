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
- My Apps -> Create App -> type **Business** -> name it **HeyLaunch**.

### 3. Choose the Instagram API setup

For a new app or new customer connections, choose **Instagram API with Unified
Login** in the Meta app dashboard. Meta says new Instagram API features ship
only on Unified Login, and newly created apps cannot set up the older Instagram
Login flow. Unified Login allows an eligible professional account to authorize
through Instagram or Facebook and does not require a Facebook Page.

HeyLaunch supports the legacy **Instagram API with Instagram Login** and has an
environment-gated Unified Login implementation for new or same-mode account
connections. Existing integrations continue to work. Cross-mode migration of
an already linked account is intentionally blocked until a dual-token migration
path is built. Unified Login stays disabled unless its backend configuration is
explicitly enabled. See `docs/architecture/META_LOGIN_MIGRATION.md` for current
limits and rollout gates.

Unified Login requires Facebook Login for Business, a Meta app owned by a
business portfolio, and a saved Instagram configuration. For this product,
request only `instagram_basic`, `instagram_manage_messages`, and
`instagram_manage_comments`; do not include ads permissions unless HeyLaunch
adds an ads feature. Prefer a non-expiring Business Integration System User
access token for ongoing server automation if Meta makes that option available
in the configuration. The token belongs to the customer's business portfolio
and stops working if the customer removes the app or moves the Instagram
account to another portfolio.

HeyLaunch keeps legacy Instagram Login as the default. Unified Login is offered
as a separate connect option only when `META_UNIFIED_LOGIN_ENABLED=true`; this
does not migrate or invalidate existing accounts. The Unified Login URL uses
the Meta app ID, configuration ID, exact HTTPS callback, `response_type=code`,
and a server-bound OAuth state. The code is exchanged server-to-server for a
Business Integration System User access token. The production redirect must be
registered in the same Meta configuration as:
`https://<your-api-domain>/api/instagram/callback`.

The Unified Login grant handler discovers all Instagram professional accounts
shared by the customer, validates the complete account list, checks account
ownership and plan capacity, then persists the selected grant atomically. One
Business Integration System User token is encrypted with each account record.
Do not enable Unified Login in production until the exact Meta configuration,
permissions, callback, account assignment, and staging behavior have been
verified. Existing Instagram Login accounts are not migrated by this flow.

### 4. Configure credentials

For the currently implemented legacy flow, the Instagram product's app ID and
secret are used by `META_APP_ID` and `META_APP_SECRET` in
`backend-nest/.env`.

Unified Login uses the **Meta app ID and Meta app secret**, plus the
configuration ID (`config_id`) created in the dashboard. They are distinct
configuration values from the Instagram product credentials used by the legacy
flow. Do not put secrets in the frontend environment or commit them. Set
`META_UNIFIED_LOGIN_ENABLED=true` and `META_UNIFIED_LOGIN_CONFIG_ID` in the
backend environment only after the Meta configuration, app-level Instagram
webhook, redirect URI, and permissions have been verified.

### 5. Set the OAuth redirect URI
- Add the exact backend callback URL in the selected login configuration:
  https://<your-api-domain>/api/instagram/callback
- Local testing with a public HTTPS tunnel:
  https://<your-tunnel-domain>/api/instagram/callback
- Use a stable, publicly reachable HTTPS API domain for the production OAuth
  and webhook callbacks. Temporary tunnel URLs can change and are suitable only
  for controlled development tests.

### 6. Set up webhooks
- App-level webhook configuration and per-account subscription are separate steps.
  First verify the callback and subscribe the required fields in Meta Developers;
  then connect the account. OAuth automatically attempts its per-account API
  subscription; if that fails, use **Set up webhooks** once on that account to
  retry. This is not a per-automation setup. The button cannot configure the app
  callback or grant permissions for you.
- In the Meta app's **Webhooks** product, select the **Instagram** object for
  Unified Login and configure:
  - Callback URL: https://<your-api-domain>/webhooks/instagram
  - Verify token: any string you choose — put the SAME string in META_WEBHOOK_VERIFY_TOKEN
  - Select fields: comments and messages
- The current [webhook field and permission matrix](https://developers.facebook.com/documentation/instagram-platform/webhooks/fields)
  requires `instagram_manage_comments` for `comments` and
  `instagram_manage_messages` for `messages` with Unified Login. Instagram
  Login uses `instagram_business_manage_comments` and
  `instagram_business_manage_messages`; its basic permission is
  `instagram_business_basic`. Unified Login also needs `instagram_basic` as its
  basic permission for profile/media access. Select only the fields and
  permissions this integration uses.
- Meta requires the app to be Live to receive notifications for customer app
  users, and business verification is required for production access. Comment
  notifications are unavailable for private media-owning accounts. Meta sends
  every app-selected webhook field to each account subscribed to the app; the
  fields cannot be selected separately per account.
- Meta calls your URL to verify; your API already answers this handshake.
- Unified Login subscriptions use the customer's Business Integration System
  User access token and `POST graph.facebook.com/{ig-user-id}/subscribed_apps`.
  Legacy Instagram Login uses its Instagram User token and
  `POST graph.instagram.com/{ig-user-id}/subscribed_apps`. The backend routes
  by the account's saved login mode and has a retry action for existing accounts.
- Meta's current product-specific webhook and private-reply guides document Reel
  comment events and private replies. An older Facebook Login-specific Webhooks
  page still says Reels are unsupported; verify Reel event delivery in your
  authorized test account before launch.

### 7. Required callback URLs (Meta needs these for any data-handling app)
- **Deauthorize callback URL:** `https://<your-api-domain>/api/instagram/deauthorize` (implemented; verifies Meta's signed request, pauses the account automations, and clears the local token)
- **Data deletion request URL:** `https://<your-api-domain>/api/instagram/data-deletion` (implemented; the response includes a public 90-day completion-status URL)
- Privacy Policy URL (a public page — you need one anyway)
- App icon + app details

### 8. Add yourself as a tester (test NOW, before approval)
- App Roles -> Roles -> add your Instagram account as a tester, OR
- Instagram product -> add an Instagram Tester account and accept the invite in
  that account's Instagram settings.
- Your own account can now connect and test the full flow in Development mode.

### 9. Request the permissions (App Review)
- For the current legacy integration, request Advanced Access to
  `instagram_business_basic`, `instagram_business_manage_messages`, and
  `instagram_business_manage_comments`.
- For Unified Login, request Advanced Access to the matching
  `instagram_basic`, `instagram_manage_messages`, and
  `instagram_manage_comments` permissions. Advanced Access and Live mode are
  required to connect customers who are not app roles.
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
| Graph API version (e.g. v26.0) | META_GRAPH_VERSION |
| Explicit outbound proxy for Meta API calls (optional) | META_HTTPS_PROXY |
| Your API base URL | PUBLIC_URL |

Meta API calls use direct HTTPS by default and ignore generic shell-level
`HTTP_PROXY`/`HTTPS_PROXY` variables, which can be stale or unrelated to Meta.
Set `META_HTTPS_PROXY` only when the backend's network requires an outbound
proxy. Do not put proxy credentials in source control or logs.

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
