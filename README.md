# HeyLaunch

HeyLaunch is an Instagram creator automation SaaS. The current product connects Instagram professional accounts and automates text DMs from matching comments or incoming messages, with optional public replies, link buttons, click tracking, follow-ups, delivery logs, and plan limits.

## Project layout

- `frontend/` — Next.js 15 and React 18 application.
- `backend-nest/` — active NestJS/Fastify API, BullMQ worker, Prisma schema and migrations.
- `backend/` — legacy Express implementation; it is not used by the current Render blueprint or local Compose stack.
- `docs/architecture/` — implementation map, data model, feature inventory, and launch/security assessment.
- `replica/` — product and design research notes, not runtime code.

## Run the full application locally

Install Docker Desktop with Docker Compose, then run from the repository root:

```sh
docker compose up --build
```

The stack starts PostgreSQL, Redis, Mailpit, the active Nest API, its BullMQ worker, and the Next.js frontend. The API applies checked-in Prisma migrations to the local PostgreSQL volume on startup. Open `http://localhost:3000`; the API readiness check is at `http://localhost:4000/ready`. Verification and reset emails are captured locally at `http://localhost:8025` and are never sent to real recipients.

The Compose credentials and keys are fixed development-only values for services published on local ports. Never reuse them outside this local stack. The stack does not configure Meta OAuth/webhooks or Razorpay; those features require test-account credentials. Stop containers with `docker compose down`. This retains the database and Redis volumes.

## Run services directly with Node

Use Node 24 for both applications. Start local PostgreSQL and Redis first, then set local backend values for `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, JWT secrets, and `ENCRYPTION_KEY`. The checked-in backend environment example documents variable names but contains provider-shaped placeholders; do not use those values as local database credentials.

```powershell
cd backend-nest
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

`npm run dev` starts the NestJS API on port 4000 directly from `src/main.ts`; `npm run start:dev` is an alias. It does not use the Nest CLI watch compiler or depend on `dist/main.js`. Restart the API terminal after backend edits. Keep PostgreSQL and Redis running before starting the API. Start the API before using login, signup, or password-reset forms so frontend requests to `http://localhost:4000` have a service to reach. For compiled startup, run `npm run build` before `npm start`.

In a second terminal, start the worker:

```powershell
cd backend-nest
npm run worker:dev
```

In a third terminal, use `frontend/.env.local.example` as the template and set `NEXT_PUBLIC_API_URL=http://localhost:4000`, then run:

```powershell
cd frontend
npm ci
npm run dev
```

Only run migrations against a local or staging database after reviewing them.

## Product limits and launch status

AI intent matching, email collection, follower gating, media attachments, recurring billing, team workspaces, lead CRM, and a full creator inbox are not implemented. The automation builder supports text messages, URL buttons, and the documented follow-up conditions. Do not market unimplemented or provider-unverified functionality.

The repository does not establish approved legal terms, refund/support operations, production provider configuration, or a verified deployment. See the [launch assessment](docs/architecture/SECURITY_AND_LAUNCH.md), [feature inventory](docs/architecture/FEATURE_INVENTORY.md), and [roadmap](docs/architecture/DEVELOPMENT_ROADMAP.md).

## Deployment

`render.yaml` declares the API, persistent worker, and frontend. The worker is required for message delivery and maintenance jobs. Review worker cost, configure provider credentials, validate migrations in staging, and complete the release gates in [DEPLOY.md](DEPLOY.md) before production use.
