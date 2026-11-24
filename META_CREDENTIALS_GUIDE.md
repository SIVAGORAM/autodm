# Meta & Instagram Credentials Step-by-Step Guide

This guide explains what each Meta / Instagram credential is, exactly where to get it in the **Meta Developers Portal**, and where to put it in your environment.

---

## 1. Quick Summary of Credentials

| Environment Variable Name | What It Represents | Where It Is Used |
| :--- | :--- | :--- |
| `META_APP_ID` | Your main Meta App ID (dialog OAuth) | Used for Facebook Login / Unified Login |
| `META_APP_SECRET` | Your main Meta App Secret | Used to exchange authorization code for access tokens |
| `META_UNIFIED_LOGIN_CONFIG_ID` | Facebook Login for Business Configuration ID | Pre-configures permissions and Instagram business assets |
| `META_UNIFIED_LOGIN_ENABLED` | Set to `true` | Tells the app to use Unified Login (recommended by Meta) |
| `INSTAGRAM_APP_ID` | Dedicated Instagram Product App ID | Used for legacy/direct Instagram Business Login fallback |
| `INSTAGRAM_APP_SECRET` | Dedicated Instagram Product App Secret | Used for direct Instagram token exchange |
| `INSTAGRAM_OAUTH_REDIRECT_URI` | The URL Meta redirects users back to | Must match character-for-character in Meta Dashboard |
| `META_WEBHOOK_VERIFY_TOKEN` | A secret string you choose | Verifies webhook handshake when Meta verifies endpoint |
| `META_GRAPH_VERSION` | Meta API version (e.g. `v26.0`) | Graph API version |

---

## 2. Step-by-Step: How to Get Each Key in Meta Developers

Go to [https://developers.facebook.com](https://developers.facebook.com) and open your App.

### Key 1: `META_APP_ID`
1. Look at the top bar or URL in your browser:
   `https://developers.facebook.com/apps/<YOUR_APP_ID>/`
2. Or on the far-left dark vertical bar, click the **⚙️ (Gear Icon)** → **App settings** → **Basic**.
3. Under **App ID**, copy the number.
   * *Example:* `1338395121470978`

---

### Key 2: `META_APP_SECRET`
1. On the same page (**App settings** → **Basic**).
2. Right next to App ID, look for **App secret**: `••••••••`.
3. Click the **Show** button next to it.
4. Enter your Facebook account password if prompted.
5. Copy the revealed secret.
   * *Example:* `80a356927e393a760879d7d329e27ef3`

---

### Key 3: `META_UNIFIED_LOGIN_CONFIG_ID`
1. In the left navigation menu, expand **Instagram API**.
2. Click **API setup with Unified login**.
3. Under **Step 1: Configure your app**, locate your configuration:
   * **Configuration ID:** `<YOUR_CONFIG_ID>`
4. Copy this ID.
   * *Example:* `1848584173153195`
5. **Important:** On this same screen under **Redirect URL**, verify that:
   `https://<your-domain>/api/instagram/callback` is selected/registered!

---

### Key 4: `META_UNIFIED_LOGIN_ENABLED`
* Always set to `true` in both your `.env` and Render Environment variables.

---

### Key 5: `INSTAGRAM_APP_ID`
1. In the left navigation menu, expand **Instagram API**.
2. Click **API setup with Instagram login**.
3. Look at the top cards:
   * You will see **Instagram app ID**.
4. Copy the ID number.
   * *Example:* `1695650171502636`

---

### Key 6: `INSTAGRAM_APP_SECRET`
1. On the same page (**Instagram API** → **API setup with Instagram login**).
2. Right next to Instagram app ID, look for **Instagram app secret**: `••••••••`.
3. Click the **Show** button.
4. Enter your Facebook password if prompted.
5. Copy the revealed secret.
   * *Example:* `428961675c1a50d53a91b0b55e488ff2`

---

### Key 7: `INSTAGRAM_OAUTH_REDIRECT_URI`
This is your frontend callback route:
* For Testing (Vercel): `https://frontend-fawn-six-26.vercel.app/api/instagram/callback`
* For Local Testing: `http://localhost:3000/api/instagram/callback`
* For Production (Custom domain): `https://yourproductiondomain.com/api/instagram/callback`

> **Note:** Whatever URL you enter here **MUST** be registered in Meta:
> 1. In **API setup with Unified login** under **Redirect URL**.
> 2. In **API setup with Instagram login** under **Step 4: Set up Instagram business login** → click **Business login settings** → **Valid OAuth Redirect URIs**.

---

### Key 8: `META_WEBHOOK_VERIFY_TOKEN`
* This is any random secret string you generate (e.g. `5fc1e144785d034eab3c06c1d0c88192`).
* When you configure webhooks in Meta:
  * **Callback URL:** `https://<your-backend-api-url>/webhooks/instagram`
  * **Verify Token:** Must match this exact string!

---

### Key 9: `META_GRAPH_VERSION`
* Set to `v26.0` (or the latest stable version configured in your Meta Dashboard).

---

## 3. Where to Paste These Keys

### A. For Local Development:
File: `backend-nest/.env`
```env
META_APP_ID="1338395121470978"
META_APP_SECRET="80a356927e393a760879d7d329e27ef3"
META_UNIFIED_LOGIN_ENABLED="true"
META_UNIFIED_LOGIN_CONFIG_ID="1848584173153195"

INSTAGRAM_APP_ID="1695650171502636"
INSTAGRAM_APP_SECRET="428961675c1a50d53a91b0b55e488ff2"

INSTAGRAM_OAUTH_REDIRECT_URI="https://frontend-fawn-six-26.vercel.app/api/instagram/callback"
META_WEBHOOK_VERIFY_TOKEN="5fc1e144785d034eab3c06c1d0c88192"
META_GRAPH_VERSION="v26.0"
```

### B. For Cloud Deployment (Render):
1. Log in to [https://dashboard.render.com](https://dashboard.render.com).
2. Click your backend service: **`relayo-api`**.
3. Go to the **Environment** tab.
4. Add or update each key listed above.
5. Click **Save Changes**.
6. Click **Manual Deploy** → **Deploy latest commit**.

---

## 4. Production Checklist (When Launching Live)

When you are ready to switch from Development/Test mode to Live Production:

1. **Meta App Mode:**
   * In Meta Developers top bar, switch App mode from **Development** to **Live**.
2. **App Review:**
   * Submit permissions for approval:
     - `instagram_business_basic`
     - `instagram_business_manage_messages`
     - `instagram_business_manage_comments`
3. **Business Verification:**
   * Verify your business entity in Meta Business Manager.
4. **Update Redirect URIs:**
   * Add your production custom domain (e.g. `https://app.yourdomain.com/api/instagram/callback`) in both Unified Login and Instagram Business Login settings.
   * Update `INSTAGRAM_OAUTH_REDIRECT_URI` in Render environment to match your production domain.
5. **Data Deletion & Privacy Policy:**
   * Ensure your Live app has:
     - Privacy Policy URL: `https://app.yourdomain.com/privacy`
     - Data Deletion URL: `https://api.yourdomain.com/api/instagram/data-deletion`
     - Deauthorization URL: `https://api.yourdomain.com/api/instagram/deauthorize`
