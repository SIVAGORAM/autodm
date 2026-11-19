# AutoDM NestJS backend — run it

Windows (PowerShell), from `D:\Projects\instagram-automation\backend-nest`:

    cd D:\Projects\instagram-automation\backend-nest
    rmdir /s /q node_modules      # the cross-OS install from the bridge is half-written; start clean
    copy .env.example .env        # then fill in .env
    npm install
    npx prisma migrate dev --name init   # creates the tables
    npm run start:dev             # API on http://localhost:4000

Second terminal — the DM worker (processes the queue):

    cd D:\Projects\instagram-automation\backend-nest
    npm run worker:dev

Check it's alive:  http://localhost:4000/health

## Tests
    npm test        # matcher logic (8 tests)

## What runs where
- `npm run start:dev`  → HTTP API (auth, automations, webhook, click redirect)
- `npm run worker:dev` → BullMQ worker that calls the Instagram API and sends DMs
- Both share Postgres + Redis.

## Notes
- `prisma generate` downloads a query engine on first run — needs normal internet (it was blocked in the build sandbox, works fine on your machine).
- Point the Meta webhook at `https://<your-domain>/webhooks/instagram` with verify token = META_WEBHOOK_VERIFY_TOKEN.
