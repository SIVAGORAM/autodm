# Relayo — Deploy to Render

Postgres (Neon) and Redis (Upstash) are already cloud — reuse the same connection strings.

## 1. Push to GitHub
Done once; Render deploys from the repo.

## 2. Create services on Render (Blueprint)
1. render.com → **New → Blueprint** → connect the GitHub repo `SIVAGORAM/autodm`.
2. Render reads `render.yaml` and proposes **relayo-api** + **relayo-frontend**.
3. Click **Apply**. It creates both (build will fail until env vars are set — that's expected).

## 3. Set environment variables (relayo-api → Environment)
Paste each value (copy from your local `backend-nest/.env`):
`DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`ENCRYPTION_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `MAIL_FROM`.
Then, after the first deploy gives you the URLs:
- `PUBLIC_URL` = the API URL, e.g. `https://relayo-api.onrender.com`
- `CORS_ORIGIN` = the frontend URL, e.g. `https://relayo-frontend.onrender.com`

**relayo-frontend → Environment:**
- `NEXT_PUBLIC_API_URL` = the API URL (same as PUBLIC_URL)

Save → **Manual Deploy → Deploy latest commit** on both.

## 4. Point Meta at the permanent URL
Meta → Instagram → API setup with Instagram login → Business login settings →
**OAuth redirect URIs**, add:
```
https://relayo-api.onrender.com/api/instagram/callback
```
Save. (No more cloudflare tunnel needed.)

## 5. The DM worker
The worker (`node dist/worker.js`) must run for DMs to actually send.
- **Free testing:** run it locally against the same Neon + Upstash:
  `cd backend-nest && npm run worker`
- **Production:** add a **Background Worker** service on Render (paid, ~$7/mo),
  rootDir `backend-nest`, build `npm install && npx prisma generate && npm run build`,
  start `node dist/worker.js`, same env vars as the API.

## 6. Instagram webhook (for live comment triggers)
Meta → Instagram → Webhooks → Callback URL:
`https://relayo-api.onrender.com/webhooks/instagram`
Verify token = your `META_WEBHOOK_VERIFY_TOKEN`. Subscribe to `comments` + `messages`.

## Notes
- Render **free** web services sleep after 15 min idle (~30s cold start). Fine for testing;
  use a paid instance for a live product so webhooks aren't missed.
- Cross-domain auth works because cookies are now `SameSite=None; Secure` when `COOKIE_SECURE=true`.
