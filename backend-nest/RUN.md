# Run HeyLaunch locally

Use separate terminals. Keep the existing `.env` files; do not copy `.env.example` over them.

## Start the API

```powershell
cd D:\Projects\instagram-automation\backend-nest
npm run dev
```

This runs `src/main.ts` directly through the installed TypeScript runtime and listens on port `4000` unless `PORT` is set. It does not depend on a generated `dist/main.js` and does not use the Nest CLI's Windows child-process watcher. Restart this terminal with `Ctrl+C` after backend code changes. For a compiled production-style local run, use:

```powershell
npm run build
npm start
```

Check liveness and dependency readiness in a browser or with `curl.exe`:

```powershell
curl.exe http://localhost:4000/health
curl.exe http://localhost:4000/ready
```

`/health` confirms the HTTP process is responding. `/ready` must return `200` with database, queue, and throttling checks set to `ok` before using API-backed dashboard sections.

The local API startup emitted a Redis eviction-policy warning during verification. BullMQ production Redis should use `maxmemory-policy noeviction`; verify/configure this in the Redis provider before launch. This repository does not change hosted Redis settings automatically.

Scheduled cleanup and trial-reminder cron jobs are disabled by default outside production. To exercise them in a controlled development environment, set `RUN_SCHEDULED_JOBS_IN_DEVELOPMENT=true` for the API process only after confirming the database, SMTP, and storage services are safe for test operations. Production cron jobs remain enabled.

## Start the frontend

In a second terminal:

```powershell
cd D:\Projects\instagram-automation\frontend
npm run dev
```

Open `http://localhost:3000`. The frontend's `NEXT_PUBLIC_API_URL` must point to the API origin (`http://localhost:4000` for the default local setup).

Meta/Instagram API requests use direct HTTPS by default so inherited shell or
machine `HTTP_PROXY`/`HTTPS_PROXY` settings cannot silently route requests
through an unrelated proxy. If your hosting network requires a proxy, configure
the optional backend `META_HTTPS_PROXY` value with its HTTP(S) proxy origin; it
is never logged. A connected test account's media read should return provider
data or a Meta HTTP permission/token error, rather than a local proxy transport
failure.

Authenticated dashboard sessions also open `/api/dashboard/events` as a user-scoped Server-Sent Events stream. Successful automation mutations, verified billing entitlements, Instagram account/webhook setup/disconnect, contact note/tag edits, durable webhook processing, and terminal message-delivery updates publish small cache-invalidation events through the existing Redis connection; the browser then refetches affected queries. This stream is advisory: Redis/SSE disconnects fall back to the existing page polling and window-focus refetch behavior. `/ready` must be healthy before expecting API-backed dashboard data. After changing backend code, restart `npm run dev`; avoid a stale `nest start --watch` process that expects generated `dist/main.js` while TypeScript is compiling.

## Background worker

In development, the delivery worker is disabled by default. Starting `worker:dev` without opting in only validates that the worker application context can start; it will not consume jobs or report a delivery-worker heartbeat. This prevents routine local startup from unexpectedly processing a shared queue.

Only when the development Redis queue and database are known to be isolated and safe, deliberately opt in before starting the worker:

```powershell
cd D:\Projects\instagram-automation\backend-nest
$env:RUN_DELIVERY_WORKER_IN_DEVELOPMENT="true"
npm run worker:dev
```

The delivery worker can send Instagram DMs and process queued webhook events. Scheduled maintenance jobs are separately disabled by default in development; enabling `RUN_SCHEDULED_JOBS_IN_DEVELOPMENT=true` also permits email outbox processing, account-deletion jobs, token refresh, and cleanup. Do not enable either flag against shared or production services. Use an authorized test account and safe recipients, and verify `/health` and `/ready` first. A connected Instagram account also needs its comment/message webhook subscription set up and live delivery tested before relying on automations.

For auth email development checks, `RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT=true` runs only the durable email outbox loop; it does not consume Instagram jobs or schedule account cleanup/token refresh. It can still send real emails, so use it only with an isolated development database and test SMTP recipients. Keep it unset for shared or production services. Start it with `npm run worker:dev` in a separate terminal.

## Database safety

- Confirm the active database target before any schema command; local `.env` may point at a remote Neon database.
- `npx prisma generate` regenerates the client and does not change database data.
- Do not use `prisma db push --force-reset`, `prisma migrate dev`, or copy an example environment file over an existing `.env` as routine startup steps.
- Apply a reviewed, intended migration with `npx prisma migrate deploy` only after confirming the target environment and migration contents.

## Checks

```powershell
cd D:\Projects\instagram-automation\backend-nest
npm test -- --runInBand
npm run build
```

```powershell
cd D:\Projects\instagram-automation\frontend
npm run lint
npx tsc --noEmit
npm run test:config
```
