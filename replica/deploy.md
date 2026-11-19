# Deploy — AutoDM / Relayo

Ship the three processes live. Stack: Next.js frontend + NestJS API + a worker,
sharing Postgres + Redis. The API and worker are the SAME image, different start
command — scale the worker separately from the API.

```
                 Vercel                 Railway (or Render)
  users ──►  Next.js frontend  ──API──►  NestJS API  ◄── Meta webhooks
                                           │  \
                                           │   └── Worker (node dist/worker.js)
                                           ▼
                                 Neon Postgres + Upstash Redis
```

## Recommended hosts (solo-friendly)
- **Frontend → Vercel** (free tier fine to start)
- **API + Worker → Railway** (two services from one repo) — or Render
- **Postgres → Neon** (pooled URL for the app, direct URL for migrations)
- **Redis → Upstash** (or Railway's Redis plugin)

---

## 1. Databases (do first)
1. Neon → create a project → copy the **pooled** connection string into `DATABASE_URL`, the **direct** one into `DIRECT_URL`.
2. Upstash → create a Redis database → copy the `rediss://…` URL into `REDIS_URL`.

## 2. Backend API (Railway)
1. Railway → New Project → Deploy from GitHub → pick the repo.
2. Set **Root Directory** = `backend-nest` (it has the Dockerfile).
3. Add env vars (from `backend-nest/.env.example`):
   `DATABASE_URL, DIRECT_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
   ENCRYPTION_KEY, META_APP_ID, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN,
   META_GRAPH_VERSION, NODE_ENV=production, COOKIE_SECURE=true,
   CORS_ORIGIN=https://<your-frontend-domain>,
   PUBLIC_URL=https://<your-api-domain>`
   Generate secrets: `openssl rand -base64 48`
4. Deploy. Railway builds the Dockerfile and runs `node dist/main.js` (the API).
5. Run migrations once (Railway shell or a one-off):
   `npx prisma migrate deploy`
6. Check: `https://<your-api-domain>/health` → `{"status":"ok"}`

## 3. Worker (second Railway service, same repo)
1. New service in the same project → same repo, same Root Directory `backend-nest`.
2. **Override the start command:** `node dist/worker.js`
3. Give it the **same env vars** as the API (share them).
4. Deploy. This process pulls jobs off Redis and sends the DMs.
   Scale this one up (more replicas / concurrency) under load — not the API.

## 4. Frontend (Vercel)
1. Vercel → Import the repo → **Root Directory** = `frontend`.
2. Env: `NEXT_PUBLIC_API_URL=https://<your-api-domain>`
3. Deploy. (Add your custom domain in Vercel → Domains.)

## 5. Meta app wiring (the part that actually turns it on)
1. In your Meta app → Instagram → set the **OAuth redirect URI**:
   `https://<your-api-domain>/api/instagram/callback`
2. Set the **Webhook callback URL**:
   `https://<your-api-domain>/webhooks/instagram`
   Verify token = your `META_WEBHOOK_VERIFY_TOKEN`. Subscribe to `comments` and `messages`.
3. Submit for **App Review** (scopes: instagram_business_basic,
   instagram_business_manage_messages, instagram_business_manage_comments) +
   Business Verification. Until approved, only your own test accounts connect.

## 6. Smoke test (prod)
- [ ] `/health` returns ok
- [ ] Sign up / log in on the live frontend (cookies set, HTTPS)
- [ ] Connect a test Instagram account via OAuth
- [ ] Create an automation, comment the keyword → DM arrives
- [ ] `/r/<slug>` redirect works and the click count increments

## Cost (starting out)
Vercel free + Railway (~$5 credit/hobby) + Neon free + Upstash free ≈ **near zero**
until you have real traffic. Worker + API on Railway are the first paid bits as you scale.

## Gotchas
- `COOKIE_SECURE=true` in prod (HTTPS) or auth cookies won't stick.
- `CORS_ORIGIN` must exactly match the frontend origin, or the browser blocks calls.
- `prisma generate` downloads an engine at build — Railway has internet, so it works (it was only blocked in the dev sandbox).
- Run `prisma migrate deploy` on every schema change, before the new code serves traffic.
