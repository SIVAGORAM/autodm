# Architecture — AutoDM (Instagram Auto-DM SaaS)

Companion to `recon.md` and `build-log.md`. Describes the stack, data model,
API surface, runtime loop and how it scales. Status reflects what is already
built in `backend-nest/` (see build-log).

## 1. Stack (decided)

| layer | choice | why |
| --- | --- | --- |
| Frontend | Next.js 15 + TS + Tailwind | already in `frontend/`, App Router, server components for the dashboard |
| Backend API | NestJS 10 on Fastify | structure + guards + DI; Fastify for throughput |
| Worker | Node + BullMQ | same codebase, separate process, scales horizontally |
| DB | PostgreSQL via Prisma | relational; Neon in prod |
| Cache / queue | Redis (Upstash) | BullMQ jobs + idempotency + follower-check TTL cache |
| Auth | JWT (access 15m + refresh 30d, rotated) | httpOnly cookies, reuse detection |
| Payments | Razorpay | India-first (T+1), already wired in old backend |
| Deploy | Vercel (frontend) + Node host (API+worker) | Railway/Render/Fly for the two Node processes |

Two Node processes share one DB + one Redis: **API** (`main.ts`) and **worker**
(`worker.ts`). Keep them separate so a flood of DMs never slows the dashboard.

## 2. System diagram

```
            ┌──────────── Instagram / Meta ────────────┐
            │  comment / story reply / DM / live        │
            └───────────────┬───────────────────────────┘
                            │ webhook (signed)
                            ▼
  Next.js  ──REST──►  NestJS API  ──enqueue──►  Redis (BullMQ)
  (dashboard)         - auth                        │
                      - automations CRUD             │ pull
                      - webhook verify+fanout        ▼
                      - /r/:slug click redirect   DM Worker ──► Meta Graph API
                            │                        │            (reply + DM)
                            ▼                        ▼
                        PostgreSQL ◄────────── runs / contacts / clicks
```

The webhook only reads + enqueues, then returns 200 instantly. All Meta calls
(slow, rate-limited) happen in the worker. That split is the whole scaling story.

## 3. Modules (backend-nest/src)

- `auth/` — signup, login, refresh (rotation + reuse detection), logout, me
- `automations/` — CRUD, status toggle, analytics, server-side plan limits, tracked-link sync
- `meta/` — Graph API client: comment-DM, direct message, public reply, follower check
- `webhook/` — signature verify, comment/message fan-out to jobs, the matcher
- `queue/` — BullMQ queue + DM processor (idempotency, ask-to-follow, buttons)
- `tracking/` — `/r/:slug` click counter + redirect
- `common/` — JWT guard, encryption (AES token-at-rest), CurrentUser decorator
- `prisma/`, `config/` — DB client, zod-validated env

## 4. Data model (Prisma)

```
User 1─n IgAccount 1─n Automation 1─n FollowUp
                   1─n Contact        1─n Run
                   1─n Run        Automation 1─n TrackedLink 1─n Click
```

Key entities: `Automation` (triggerType, matchMode, keywords, publicReplies,
dmBlocks json, flags), `Run` (one per trigger event — `triggerEventId` unique =
idempotency), `Contact` (IGSID, dmsSent, first/last interaction — the CSV
export source), `TrackedLink`/`Click` (redirect tracking). Full schema in
`backend-nest/prisma/schema.prisma`.

## 5. API surface

Built:
```
POST   /api/auth/signup | login | refresh | logout
GET    /api/auth/me
POST   /api/automations
GET    /api/automations
GET    /api/automations/:id
PATCH  /api/automations/:id
PATCH  /api/automations/:id/status
GET    /api/automations/:id/analytics
DELETE /api/automations/:id
GET/POST /webhooks/instagram          (Meta verify + events)
GET    /r/:slug                        (click redirect)
GET    /health
```

To build:
```
GET    /api/instagram/auth-url | callback   (OAuth connect — port from old backend)
GET    /api/instagram/media                 (post/reel picker)
GET    /api/automations/:id/runs            (paginated run log)
GET    /api/contacts  +  /api/contacts/export (CSV)
POST   /api/automations/:id/followups       (24h follow-up steps)
```

## 6. Runtime loop + the rules that bite

1. Webhook verifies `X-Hub-Signature-256` (HMAC SHA-256 over raw body), acks 200.
2. Fan-out: match comment/message text against live automations (keyword / any / AI-intent).
3. Enqueue one job, `jobId = triggerEventId` → queue-level dedupe.
4. Worker: DB idempotency check → upsert contact → ask-to-follow gate (follower
   cache) → rotate public reply → send DM with buttons → record Run + increment contact.
5. Retryable Meta errors (rate limit / transient) throw → BullMQ exponential backoff, 5 attempts.

**Meta constraints that shape the design:**
- 24-hour messaging window → follow-ups must schedule inside it (delayed jobs).
- Per-account send rate limits → `dailyLimit` on Automation + worker concurrency cap.
- Private replies only work once per comment → idempotency is mandatory, not optional.
- Auto-DM only on organic posts (not boosted/ads).

## 7. Scaling

- Stateless API + worker → run N replicas behind a load balancer.
- Redis + Postgres are the only shared state; use a Postgres pooler (PgBouncer/Neon pooled URL).
- Worker concurrency is a dial (currently 10); add worker processes for more throughput.
- Realistic peak is hundreds–low-thousands of events/sec even at large scale, because
  Meta webhooks only fire on real engagement. The queue absorbs spikes.
- Hot paths to watch: follower-check (cache in Redis with TTL), the fan-out query
  (index on `igAccountId, triggerType, status` — already in schema).

## 8. Security

- httpOnly cookies, refresh-token rotation + family invalidation on reuse.
- IG access tokens AES-encrypted at rest.
- Webhook signature required; unsigned payloads rejected 401.
- Zod validation on every request body; Nest ValidationPipe (whitelist) strips extras.
- Throttler (120 req/min) + helmet.
- Plan limits enforced server-side (never trust the UI).

## 9. Deployment plan

- Frontend → Vercel (`frontend/`), env `NEXT_PUBLIC_API_URL`.
- API + worker → one Node host (Railway/Render/Fly), two processes:
  `npm run start` and `npm run start:worker`.
- DB → Neon (pooled URL for the app, direct URL for migrations).
- Redis → Upstash.
- Meta webhook → `https://api.yourdomain.com/webhooks/instagram`.
- Needs its own Meta app + App Review (instagram_manage_messages, instagram_manage_comments)
  + Business Verification before real accounts can connect.

## 10. Build order from here

1. Instagram OAuth connect (port `instagram.service` from old backend) — so you can link an account and send a real test DM.
2. Frontend 3-step builder + phone preview + automations dashboard wired to the API.
3. Run log + contacts list + CSV export.
4. Follow-up scheduler (delayed BullMQ jobs, 24h window).
5. AI-intent matching (LLM call in the webhook deferral path).
6. Razorpay plan gating end to end.
