# Deployment and local operation

## Declared production topology

`render.yaml` defines three Render services:

1. `relayo-api`: Node web service rooted at `backend-nest`; `npm ci`, Prisma client generation, Nest build; startup runs `prisma migrate deploy` before the HTTP API.
2. `relayo-worker`: persistent background worker rooted at `backend-nest`; builds the Nest app and runs `npm run start:worker`. It processes DMs, durable webhook receipts, delayed follow-ups, encrypted auth-mail outbox retries, token refresh, and stale-run recovery.
3. `relayo-frontend`: Node web service rooted at `frontend`; `npm ci`, production Next standalone build (including copied `public` and `.next/static` assets), and `npm start` on the generated `.next/standalone/frontend/server.js` server. The nested path reflects `outputFileTracingRoot` at the repository root.

All three auto-deploy. The API and frontend are configured as free web services while the worker uses a paid always-on plan. A free API may cold-start or sleep; validate Meta webhook delivery and user experience at the chosen hosting tier. The API performs migrations at startup, so review this behavior and use a tested staging rollout before production.

## Runtime versions and environment

The API, worker, and frontend are pinned to Node `24.22.1` in `render.yaml`; package manifests constrain both apps to Node `>=24 <25`. The active Nest Dockerfile also uses Node `24.22.1`. Local build verification used Node `24.13.1`; the pinned Render/container runtime still requires a staging deploy check. API secrets/config include PostgreSQL runtime/direct URLs, Redis URL, distinct strong JWT secrets, encryption key, Meta app/webhook values, Razorpay keys, SMTP credentials, HTTPS public URL, and exact frontend CORS origins. Frontend requires `NEXT_PUBLIC_API_URL` at build/runtime as appropriate. Use `.env.example` files as shape references; never copy real values into source or audit documents.

The worker receives the service configuration through Render environment references. Confirm each reference resolves in the actual Blueprint before launch, and ensure secret values do not appear in build logs. The frontend production build requires `NEXT_PUBLIC_API_URL` as an absolute API origin with no path, query, fragment, or credentials; on Render it must use HTTPS and a public hostname. Development alone falls back to `http://localhost:4000` when unset. Docker builds must pass `--build-arg NEXT_PUBLIC_API_URL=...`; Compose already passes its local API origin explicitly.

## Local development

The root Compose stack is the recommended full-stack local setup. It starts PostgreSQL 16, Redis 7, Mailpit, the active Nest API, its worker, and the Next frontend, binds host ports to `127.0.0.1`, and applies the repository's migrations to its local database volume when the API starts. Verification and reset email is captured by Mailpit at `http://localhost:8025` and not sent externally. Its checked-in passwords and signing keys are development-only. Meta OAuth/webhooks and payment-provider flows still require test credentials.

```sh
docker compose up --build
```

Open `http://localhost:3000`; the API readiness endpoint is `http://localhost:4000/ready`. Stop with `docker compose down` to retain local data. Do not point this stack at a production database or Redis service.

For direct Node development, prerequisites are Node 24, reachable PostgreSQL and Redis, configured local environment variables, and working SMTP/Meta/Razorpay sandboxes only when exercising those integrations.

```powershell
cd backend-nest
npm ci
npm run prisma:generate
npm run dev
```

The development command loads `src/main.ts` directly and does not use a compiled `dist/main.js` or file watcher. Restart it after backend changes. For compiled startup, run `npm run build` before `npm start`.

In another terminal:

```powershell
cd backend-nest
npm run worker:dev
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Review SQL before running `npm run prisma:deploy`, and point it only at a disposable local or staging database. The root `docker-compose.yml` models the active local service topology; it is not a production deployment. `nginx/nginx.conf` contains placeholder hostnames/certificate paths. The active backend Dockerfile aligns with Node 24.22.1 and copies the generated Prisma client into the production-only dependency layer. Docker image build and startup remain unverified here because the Docker CLI is unavailable; the Compose YAML was parsed locally.

## CI, health, and recovery

`.github/workflows/secret-scan.yml` runs Gitleaks against checked-out files and all reachable Git history on pull requests, pushes, manual dispatch, and a weekly schedule. It does not scan ignored local environment files. `.github/workflows/ci.yml` runs backend Prisma generation/validation, applies all migrations to a fresh GitHub Actions PostgreSQL service, runs unit tests/build, starts the API against PostgreSQL and Redis, checks `/ready`, and runs an isolated HTTP smoke flow covering signup persistence, HTTP-only cookies, refresh-token hashing/rotation/replay defense, cookie-origin CSRF checks, login/logout, and Razorpay webhook signature acceptance/rejection with a no-entitlement-change assertion for an invalid capture event. The smoke script refuses non-loopback database and Redis targets before making requests. It then builds the frontend. The workflow has not yet been observed running on GitHub; payment entitlement application/races, quota concurrency, webhook-to-worker delivery, account-lifecycle, and provider-sandbox integration tests remain outstanding. There is also no production error tracker, external metrics/alerting stack, database backup definition, or restore runbook. `/health` confirms only that the API process can answer; `/ready` also probes PostgreSQL and Redis. The worker writes a short-lived Redis heartbeat, and verified administrators can inspect its age, queue counts, oldest waiting-job age, and delayed-job due/overdue age at `/api/admin/health/worker`; external alert thresholds and worker monitoring integrations remain to be configured.
