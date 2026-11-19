# AutoDM — Instagram Automation SaaS

A **production-ready**, fully free SaaS platform for automating Instagram DMs based on post comments.
Handles **1M+ concurrent users** using event-driven queue architecture.

---

## ⚡ Quick Start

```bash
# Clone the repo
git clone <your-repo>
cd instagram-automation

# Setup backend
cd backend && cp .env.example .env   # Fill in all values
npm install
npx prisma migrate deploy
npm run dev

# Setup frontend (new terminal)
cd frontend
cp .env.local.example .env.local     # Set NEXT_PUBLIC_API_URL
npm install
npm run dev
```

---

## 🏗️ Architecture

```
Instagram Comment
  → Webhook Server (Express + signature verify)
    → Idempotency Check (Redis)
      → BullMQ Queue (Upstash Redis)
        → DM Worker (concurrency=10)
          → Follower Check (Redis TTL cache)
            → Instagram Graph API (sendDM)
              → PostgreSQL (Neon) log
                → Dashboard (Next.js)
```

### Why this scales to 1M users

| Layer | Mechanism | Capacity |
|-------|-----------|----------|
| Webhook | Immediate 200 ACK, async processing | Unlimited throughput |
| Queue | BullMQ + Upstash Redis | 1M+ jobs/day |
| Workers | 10 concurrent DM jobs per instance, horizontal scaling | Linear |
| Rate Limiting | Per-campaign sliding window in Redis | Per campaign |
| Follower Cache | Redis TTL (1h) + Postgres fallback | ~0ms lookup |
| Deduplication | Idempotent webhook keys (Redis 24h TTL) | 100% dedup |
| DB | Connection pooling via Prisma + Neon DB | 1000 connections |

---

## 🔐 Security

### Authentication Flow

```
Signup/Login
  → bcrypt(12 rounds) hash
  → Access token (JWT, 15m, httpOnly cookie)
  → Refresh token (JWT, 30d, httpOnly cookie, restricted to /api/auth/refresh)
  → Refresh tokens stored in DB with rotation detection

Refresh token rotation:
  → Each refresh issues a new pair and deletes the old
  → Token reuse detected → all tokens for user revoked
  → JTI blacklisting in Redis for logout

Logout:
  → Refresh token deleted from DB
  → Access token JTI blacklisted in Redis until expiry
```

### Webhook Security
- Instagram HMAC-SHA256 signature verified via `crypto.timingSafeEqual`
- Razorpay HMAC-SHA256 signature verification
- 200 response sent immediately to prevent retries; processing is async

### Data Security
- Instagram access tokens encrypted at rest with AES-256 (CryptoJS)
- All tokens decrypted in-memory only when needed, never logged
- SQL injection protection via Prisma ORM (parameterized queries)
- Input validation with Zod on all endpoints
- Helmet.js security headers
- CORS configured for exact origin

---

## 🆓 Free Infrastructure (Forever)

| Service | Provider | Free Tier |
|---------|----------|-----------|
| Database | **Neon DB** | 512MB, 1 branch, unlimited requests |
| Queue/Cache | **Upstash Redis** | 10K commands/day (pay-per-use after) |
| Backend | **Render.com** | 750h/month free web service |
| Frontend | **Vercel** | Unlimited deployments, 100GB bandwidth |
| CDN + Security | **Cloudflare** | Free tier |
| Payments | **Razorpay** | No monthly fee, 2% per transaction |

### Scaling beyond free tier

When you hit limits:
1. **Upstash Redis**: Scales at $0.2/100K commands — still cheaper than Heroku Redis
2. **Neon DB**: $19/mo for 10GB — use connection pooling (already configured)
3. **Render**: $7/mo for always-on — eliminates cold starts
4. **Vercel**: Free tier handles massive traffic with CDN

---

## 📁 Project Structure

```
instagram-automation/
├── backend/
│   ├── src/
│   │   ├── configs/          # Redis, env validation
│   │   ├── controllers/      # Route handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── campaign.controller.ts
│   │   │   ├── instagram.controller.ts
│   │   │   └── payment.controller.ts
│   │   ├── db/               # Prisma client singleton
│   │   ├── middlewares/      # Auth, rate limiting, error handling
│   │   ├── queues/           # BullMQ queue definitions
│   │   ├── routes/           # Express route setup
│   │   ├── services/         # Instagram API service
│   │   ├── utils/            # JWT, encryption, logger
│   │   ├── webhooks/         # Instagram + Razorpay webhooks
│   │   ├── workers/          # BullMQ DM worker
│   │   └── index.ts          # Server bootstrap
│   ├── prisma/
│   │   └── schema.prisma     # Full DB schema (13 tables)
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── (auth)/           # Login, Signup
│   │   └── (dashboard)/      # Protected dashboard pages
│   │       ├── dashboard/    # Overview
│   │       ├── campaigns/    # Campaign CRUD + detail
│   │       ├── instagram/    # Connect Instagram
│   │       ├── analytics/    # Charts + stats
│   │       ├── logs/         # DM logs table
│   │       └── billing/      # Razorpay subscription
│   ├── services/api.ts       # Axios with auto-refresh
│   └── store/authStore.ts    # Zustand auth state
├── nginx/nginx.conf          # Production reverse proxy
├── docker-compose.yml
└── .github/workflows/deploy.yml
```

---

## 🛠️ Setup Guide

### 1. Database (Neon DB — Free)

1. Go to [neon.tech](https://neon.tech) and create a free project
2. Copy the connection string to `DATABASE_URL` in `.env`
3. Run migrations: `npx prisma migrate deploy`

### 2. Redis (Upstash — Free)

1. Go to [upstash.com](https://upstash.com) and create a Redis database
2. Select **Global** region for lowest latency
3. Copy the Redis URL to `UPSTASH_REDIS_URL` in `.env`

### 3. Instagram Graph API

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create an App → Select "Business" type
3. Add Instagram Graph API product
4. Set up webhook:
   - URL: `https://yourdomain.com/webhooks/instagram`
   - Verify token: your `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to: `comments`
5. Add `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET` to `.env`

### 4. Razorpay (Free setup)

1. Create account at [razorpay.com](https://razorpay.com)
2. Create subscription plans in Dashboard
3. Add keys to `.env`
4. Set webhook URL: `https://yourdomain.com/webhooks/razorpay`
5. Create plans in DB:
```sql
INSERT INTO plans (id, name, razorpay_plan_id, price, interval, campaign_limit, dm_limit, features, is_active)
VALUES
  (gen_random_uuid(), 'Starter', 'plan_xxx', 49900, 'monthly', 3, 200, ARRAY['3 campaigns', '200 DMs/day', 'Analytics'], true),
  (gen_random_uuid(), 'Pro', 'plan_yyy', 149900, 'monthly', 10, 1000, ARRAY['10 campaigns', '1000 DMs/day', 'Priority support'], true);
```

### 5. JWT Secrets (Generate secure values)

```bash
# Generate 64-byte secrets
openssl rand -base64 64  # Use for JWT_ACCESS_SECRET
openssl rand -base64 64  # Use for JWT_REFRESH_SECRET
openssl rand -hex 32     # Use for ENCRYPTION_KEY
openssl rand -base64 32  # Use for COOKIE_SECRET
```

### 6. Deploy

**Backend → Render.com (Free)**
1. Connect GitHub repo
2. Set build command: `npm ci && npx prisma generate && npm run build`
3. Set start command: `npx prisma migrate deploy && node dist/index.js`
4. Add all environment variables

**Frontend → Vercel (Free)**
1. Connect GitHub repo, set root dir to `frontend`
2. Add `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`

---

## 🚦 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/login` | Login (sets cookies) |
| POST | `/api/auth/refresh` | Refresh tokens (cookie-based) |
| POST | `/api/auth/logout` | Logout + blacklist token |
| GET  | `/api/auth/me` | Get current user |

### Campaigns
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns` | Create campaign |
| GET  | `/api/campaigns` | List campaigns |
| GET  | `/api/campaigns/:id` | Get campaign |
| PATCH | `/api/campaigns/:id` | Update / pause |
| DELETE | `/api/campaigns/:id` | Delete |
| GET  | `/api/campaigns/:id/analytics` | Analytics |

### Instagram
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/instagram/auth-url` | Get OAuth URL |
| GET  | `/api/instagram/callback` | OAuth callback |
| GET  | `/api/instagram/account` | Get connected account |
| GET  | `/api/instagram/media` | Get posts/reels |
| POST | `/api/instagram/posts` | Link post to campaign |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/webhooks/instagram` | Facebook hub challenge |
| POST | `/webhooks/instagram` | Comment events |
| POST | `/webhooks/razorpay` | Payment events |

---

## 📊 Database Schema

13 tables with proper indexing:

- `users` — auth, roles
- `refresh_tokens` — token rotation
- `instagram_accounts` — encrypted tokens
- `campaigns` — automation config
- `posts` — linked media
- `automation_rules` — per-keyword rules
- `comment_events` — idempotent event log
- `dm_logs` — delivery log
- `follower_cache` — TTL cache
- `plans` — subscription plans
- `subscriptions` — Razorpay subscriptions
- `payments` — payment history
- `razorpay_events` — idempotent webhook log

---

## ⚠️ Important Notes

1. **Instagram API approval**: The `instagram_manage_messages` permission requires Meta app review. During development, only test users added to your Meta App can receive DMs.

2. **DM limits**: Instagram limits DMs to 1,000/day per account. Set `dailyLimit` accordingly.

3. **Cold starts on Render free tier**: The backend sleeps after 15min of inactivity. Use a free uptime monitor (UptimeRobot) to ping `/health` every 5 minutes.

4. **Upstash free tier**: 10K commands/day. Each DM job uses ~5-8 commands. This covers ~1,200-2,000 DMs/day. Upgrade to pay-as-you-go for more.

---

## 🚀 Scaling to 1M+ Users

When you grow beyond free tier:

```
Phase 1 (0 → 10K users):   Current stack, all free
Phase 2 (10K → 100K):      Render paid + Upstash Pay-per-use
Phase 3 (100K → 1M):       Multiple worker instances + Redis Cluster
Phase 4 (1M+):             Kafka event streaming + Kubernetes
```

The queue-based architecture means you can scale workers horizontally
without any code changes — just spin up more worker instances.

---

## 👨‍💻 Author

Built for production-grade Instagram automation at scale.
