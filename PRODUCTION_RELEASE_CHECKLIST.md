# HEYLAUNCH — PRODUCTION RELEASE CHECKLIST

## Pre-Flight Release Gates

- [x] **Backend Automated Tests:** 80/80 Jest test suites passed (634/634 tests).
- [x] **Frontend Production Build:** 47/47 static and dynamic Next.js routes built cleanly without errors.
- [x] **Frontend Configuration Policies:** API URL policy, output policy, auth refresh policy, and Instagram login config checks passing.
- [x] **Unicode Keyword Matcher:** Indic matras, script combining marks, and emojis validated.
- [x] **Conversational Gating:** Follow-First verification and email collection state machine verified.
- [x] **Round-Robin Public Replies:** Concurrency-safe Redis sequential rotation implemented.
- [x] **Multi-Tenant Contact Filtering:** Disconnected accounts strictly filtered from all UI dropdowns and contact lists.
- [x] **Disconnect Confirmation UI:** Replaced browser-native popup with custom modal dialog.

---

## Environment Variables Audit

Verify the following variables are configured in Render/Vercel:

| Variable | Description | Production Requirement |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | Dedicated connection pooler enabled |
| `REDIS_URL` | Redis connection string for BullMQ | Redis 7+ with persistence enabled |
| `META_APP_ID` | Meta App ID from Meta Developers | Live Meta App ID |
| `META_APP_SECRET` | Meta App Secret | Kept strictly confidential |
| `INSTAGRAM_APP_SECRET` | Instagram Login App Secret | Kept strictly confidential |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | 32-byte hexadecimal AES key | High-entropy random secret |
| `JWT_SECRET` | User session JWT signing secret | 64+ characters random secret |
| `WEBHOOK_VERIFY_TOKEN` | Token entered in Meta Webhook config | Matches Meta Developer portal entry |

---

## Post-Deployment Rollback Runbook

If Meta rate limits or webhook anomalies occur post-deployment:
1. **Kill Switch:** Set `DISABLE_AUTOMATION_EXECUTION=true` in backend environment to immediately pause worker consumption while keeping user dashboard accessible.
2. **Redis Queue Pause:** Run `bullmq:pause` or flush queue if rogue payload storms occur.
3. **Rollback Target:** Revert Git commit to previous stable release tag on main branch.
