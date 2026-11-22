# Deploying HeyLaunch on Render

The checked-in `render.yaml` defines three services: API (`relayo-api`), continuous BullMQ/token refresh worker (`relayo-worker`), and Next.js frontend (`relayo-frontend`). The worker is necessary for DMs and token refresh. It is a continuously running paid service; review current Render pricing and selected plan before applying.

**The current Blueprint is staging-only:** both the API and frontend use Render's Free plan. Render Free web services spin down after 15 minutes without inbound traffic and take about a minute to wake. A sleeping API can delay Meta webhook acknowledgements and user API requests; a sleeping frontend can make the first visit slow. Render explicitly advises against Free services for production. Move the API and server-rendered frontend to always-on paid compute before launch, and review the recurring cost before applying the Blueprint. See [Render Free instance limitations](https://render.com/docs/free).

## Before creating services

1. The Render Blueprint pins API, worker, and frontend to Node 24.22.1; both package manifests support Node 24. Verify the exact runtime during staging deployment.
2. Prepare a PostgreSQL database and Redis deployment, including pooled/direct DB URLs if the provider requires both.
   - For Upstash Redis, keep its **Eviction** feature disabled for BullMQ. When enabled, Upstash uses `optimistic-volatile`; BullMQ requires `noeviction` because eviction can corrupt queue state. With eviction disabled, Upstash rejects writes at its storage limit, so monitor memory and choose suitable capacity. See [Upstash eviction settings](https://upstash.com/docs/redis/features/eviction) and [BullMQ production requirements](https://docs.bullmq.io/guide/going-to-production).
3. Set the API secrets in the Render dashboard: `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, SMTP variables, `PUBLIC_URL`, and `CORS_ORIGIN`. Keep the Cloudinary API secret only on the backend. Avatar uploads remain disabled until all three Cloudinary credentials are configured. Confirm `UNVERIFIED_ACCOUNT_RETENTION_DAYS` (default 30) matches the approved Privacy Notice before enabling production signup. Set the optional `SUPPORT_NOTIFICATION_EMAIL` to an operator-owned inbox if you want support/feedback submissions and customer replies forwarded there.
4. Set the frontend `NEXT_PUBLIC_API_URL` to the API's public HTTPS origin (for example, `https://relayo-api.onrender.com`), with no `/api` path, query, fragment, or credentials. Set `NEXT_PUBLIC_SITE_URL` to the canonical public frontend origin, including the custom domain you want in public profile canonical URLs and the sitemap. Do not leave it unset when using a custom domain: Render's `RENDER_EXTERNAL_URL` fallback is the `onrender.com` service URL. The production build now fails if `NEXT_PUBLIC_API_URL` is missing or is not a public HTTPS origin on Render. `PUBLIC_URL` is the API URL; `CORS_ORIGIN` is the exact frontend origin.
5. Browser API and authentication requests use the frontend's same-origin `/api` path, which Next.js rewrites to `NEXT_PUBLIC_API_URL`. This keeps session cookies first-party when frontend and API services are on separate hosts. Keep the proxy rewrite enabled in production builds; the frontend host must be able to reach the API origin over HTTPS.
6. Review every pending Prisma migration against staging. The API start command runs `prisma migrate deploy`; do not point it at production before staging validation and a backup/restore plan. Configure PostgreSQL URLs with an explicit `sslmode=require`, `verify-ca`, or `verify-full`, and Redis with a TLS URL (`rediss://`); production env validation rejects unencrypted connections.
7. The Render Blueprint keeps `autoDeploy` disabled for the API, worker, and frontend. After all staging, backup/restore, and migration checks pass, use an explicit manual deploy from Render. The API startup applies pending migrations, so do not manually deploy it before approving that exact migration set.

## Apply and configure

Create a Render Blueprint from this repository and review all three proposed services, especially the paid worker. Set the secrets above, then deploy. Confirm `/health`, API logs, worker logs, database connection, Redis connection, and frontend API connectivity.

In Meta's developer dashboard, configure the OAuth redirect URL:

```text
https://<api-host>/api/instagram/callback
```

Configure the Instagram webhook callback:

```text
https://<api-host>/webhooks/instagram
```

Use the same `META_WEBHOOK_VERIFY_TOKEN` as the API. Request and configure only the Meta app permissions/webhook fields your reviewed product workflow needs; complete Meta App Review and test with eligible creator accounts before launch.

## Operational checks

- Verify the worker consumes a test job and refreshes a test token in a non-production account.
- Confirm alerts and logs exclude tokens, passwords, OTPs, reset links, payment signatures, and full customer payloads.
- Check queue depth, failed jobs, DB pool pressure, Redis memory/limits, API health, and email delivery.
- Create a database backup and complete a restore drill before production use.
- Do not assume manual 30-day plan payments renew automatically. Recurring billing is not implemented.

The repository does not provision a DB, Redis, Meta app, SMTP account, Razorpay account, DNS, monitoring, or backup service. The codebase audit did not verify any live deployment or provider configuration. See [security and launch readiness](docs/architecture/SECURITY_AND_LAUNCH.md).
