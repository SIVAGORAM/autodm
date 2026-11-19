# Build log — AutoDM

Stack: Next.js (frontend, existing) + NestJS/Fastify (backend-nest, new). Postgres (Prisma) + Redis (BullMQ).
Old Express backend kept untouched in `backend/` as backup.

| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | NestJS scaffold | done | Fastify, helmet, cookies, throttler, zod env validation |
| 2026-11-18 | Prisma schema | done | User, IgAccount (multi), Automation, FollowUp, Contact, Run, TrackedLink, Click, WebhookEvent |
| 2026-11-18 | Auth module | done | signup/login/refresh/logout/me; refresh-token rotation + reuse detection (ported) |
| 2026-11-18 | Meta Graph client | done | comment-DM, direct message, public reply, follower check, retryable-error detection |
| 2026-11-18 | Webhook | done | GET verify + POST handler, HMAC SHA-256 signature check, acks fast then processes async |
| 2026-11-18 | Matcher | done | keyword/any/ai-intent; whole-word, emoji-safe; 8 unit tests passing |
| 2026-11-18 | Queue + DM worker | done | BullMQ, concurrency 10, idempotency (jobId + DB unique), ask-to-follow gate, public reply, buttons |
| 2026-11-18 | Automations CRUD | done | create/list/get/update/status/delete/analytics; server-side free-plan limits; tracked-link sync |
| 2026-11-18 | Click tracking | done | /r/:slug redirect counts clicks then 302s |
| 2026-11-18 | Verify | done | nest build OK (main.js + worker.js), tsc 0 errors, jest 8/8 |
| — | Frontend 3-step builder | next | S04–S10 in Next.js wired to the Nest API |
| — | Instagram OAuth connect | todo | port from old backend's instagram.service |
| — | Follow-ups scheduler | todo | 24h window, delayed BullMQ jobs |
| — | AI intent matching | todo | LLM call in webhook deferral path |

## Harder than expected
- Installing node_modules onto the Windows drive over the bridge fails (npm atomic renames). Build + tests were verified in a Linux sandbox instead; install natively on Windows (see RUN.md).

## Frontend (2026-11-18)
| date | screen | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Design tokens wired | done | globals.css + tailwind on teal/coral tokens; success/warning added |
| 2026-11-18 | UI primitives | done | Button, Card, Badge, Toggle, Stepper, TagInput, Input, Textarea, Skeleton, StatTile |
| 2026-11-18 | S04 Automations list | done | empty / loading (skeletons) / filled / error states; pause-resume; token-based |
| 2026-11-18 | S05–S09 3-step builder | done | trigger picker (paid-locked), keywords+public replies, DM+buttons+flags, review, phone preview; inline validation |
| 2026-11-18 | automationApi client | done | create/list/get/update/status/analytics/remove |
| 2026-11-18 | Verify (frontend) | done | tsc 0 errors; next build OK; both /dashboard/automations routes compiled |
| 2026-11-18 | Fixed pre-existing | done | 4 implicit-any errors in notifications/page.tsx (would have broken next build) |

### Not done / honest gaps
- Screenshots for diff: not captured (no running instance in this session).
- Builder renders dark (wrapped `.dark`) to match the existing dashboard shell.
- Existing campaign/dashboard pages still point at the OLD `/campaigns` API; the new flow uses `/automations`. Migrate or run both.

## Instagram OAuth connect (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | IG OAuth (NestJS) | done | Instagram Login API; code→short→long-lived token; signed `state` ties callback to user (no cookie needed) |
| 2026-11-18 | Multi-account + plan cap | done | create/upsert by igUserId; free=1, paid=5 active accounts enforced |
| 2026-11-18 | Endpoints | done | GET auth-url, GET callback, GET accounts, GET accounts/:id/media, DELETE accounts/:id |
| 2026-11-18 | Frontend connect page | done | /dashboard/instagram: connect / list / disconnect, success+error banners from callback redirect |
| 2026-11-18 | Verify | done | nest build OK (instagram compiled), jest 8/8; frontend tsc 0, next build OK |
| — | Token refresh cron | todo | refreshLongLivedToken exists; needs a scheduled job before 60-day expiry |
| — | Follow-up scheduler / AI intent / Razorpay gating | todo | next backend pieces |

### Notes
- Needs real Meta app credentials in `backend-nest/.env` (META_APP_ID/SECRET) + the redirect URI `${PUBLIC_URL}/api/instagram/callback` whitelisted in the Meta app.
- Scopes: instagram_business_basic, instagram_business_manage_messages, instagram_business_manage_comments (require App Review for production).

## Self-test pass (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | BUG-1 click tracking | fixed | buttons now use /r/:slug redirect; dm-blocks.ts + 7 tests |
| 2026-11-18 | BUG-2 story/DM cross-fire | fixed | classify by message.reply_to.story |
| 2026-11-18 | Test suite | done | 20 backend tests passing (matcher, dm-blocks, signature) |
| 2026-11-18 | bug-report.md / test-plan.md | done | 6 known gaps documented; manual QA checklist written |

## Parity (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Feature parity | done | 69% overall; must 88%, should 58%, could 6%; parity.md written |

## Entrepreneur / reviews (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Review research | done | ManyChat + SuperProfile across G2/Capterra/Trustpilot/forum; reviews.csv (13 linked rows) |
| 2026-11-18 | feedback.md | done | 6 themes ranked; reliability = loudest, cross-product; 2 marked thin |
| 2026-11-18 | fixes.md | done | 3 lists + 7-item fix plan + 3 angles; recommend reliability/transparency |
| 2026-11-18 | features.csv | done | +5 differentiator rows (F1–F4, F6), original=no |

## Brand (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Brand | done | name shortlist (rec: Relayo), tagline "Know it's working", voice, logo + token usage; brand.md |

## Launch (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Landing page | done | reliability-led, teal/coral tokens, responsive; replica/launch/index.html (publish to a public URL was blocked by a safety classifier — delivered as a file) |
| 2026-11-18 | Pricing + store listing | done | Free + Pro ₹499 flat; App Store/Play copy; launch.md |

## Landing page — corrected to Next.js (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Landing page (Next.js) | done | rebuilt as frontend/app/landing/page.tsx (Tailwind + design tokens); tsc 0, next build OK; route /landing. Standalone HTML retired to _to_delete |
| 2026-11-18 | Go-to-market plan | done | first-10 / first-100 India-first plan, content angles, pricing rollout, metrics; in launch.md |

## Deploy (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Deploy runbook | done | Vercel + Railway (API & worker) + Neon + Upstash; backend-nest Dockerfile + .dockerignore; Meta wiring + smoke test; deploy.md |

## Wave 1 — personalization + token refresh (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Personalization tags | done | {{name}}/{{first_name}}/{{username}} resolved at send; pure personalize() + 5 tests; builder has insert chips |
| 2026-11-18 | Token-refresh worker | done | daily maintenance job (3am cron) refreshes IG tokens <7d from expiry; fixes KNOWN-4 (60-day death) |
| 2026-11-18 | DI fix | done | EncryptionService made a global CommonModule — the DM worker would have failed to start at runtime without it |
| 2026-11-18 | Verify | done | nest build OK, jest 25/25; frontend tsc 0 |

## Wave 1 — follow-ups (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Follow-up engine | done | delayed BullMQ jobs scheduled on primary send; 24h-window guard; conditions DELAY / NO_REPLY / LINK_NOT_CLICKED |
| 2026-11-18 | Reply tracking | done | webhook records Contact.lastReplyAt (new schema field) for the NO_REPLY condition |
| 2026-11-18 | API + plan gate | done | create/update accept followUps (max 3); free plan blocked server-side |
| 2026-11-18 | Builder UI | done | follow-ups section in step 3: condition + delay + message; paid-gated |
| 2026-11-18 | Verify | done | nest build OK, jest 25/25, frontend tsc 0 |

### NOTE: schema changed (Contact.lastReplyAt) — run `npx prisma migrate dev --name followups` before next run.
### BOUGHT / NOT_BOUGHT / FORM_NOT_SUBMITTED conditions are stubbed (skipped) until purchase/form events exist.

## Wave 1 — reliability dashboard (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Health status | done | pure computeHealth() + 6 tests: healthy / at_risk / needs_reconnect / paused / draft; from status + token expiry + recent failures |
| 2026-11-18 | Delivery log API | done | GET /automations/:id/runs (paginated, cursor); health on list + detail |
| 2026-11-18 | Automation detail page | done | NEW /dashboard/automations/[id] — health banner + reconnect CTA, stat tiles, delivery-log table (this route previously 404'd) |
| 2026-11-18 | List health badges | done | each row shows Healthy / Needs reconnect / At risk |
| 2026-11-18 | Verify | done | nest build OK, jest 31/31, next build OK (all automations routes) |

### Still to do for full F1: email/push break alerts (needs the mailer ported from old backend).

## Wave 1 — mailer + break alerts (2026-11-18)
| date | area | status | notes |
| --- | --- | --- | --- |
| 2026-11-18 | Mailer (NestJS) | done | nodemailer MailService, resilient (logs if SMTP unset); Relayo-branded templates |
| 2026-11-18 | Break alerts | done | token-refresh job emails the user when a connection dies; deduped to 1/24h via IgAccount.lastAlertAt |
| 2026-11-18 | Verify | done | nest build OK, jest 31/31 (nodemailer added to deps) |

### F1 now complete: in-app health status + delivery log + email break alerts.
### Schema changed again (IgAccount.lastAlertAt) — the `followups` migration or a new one covers it: `npx prisma migrate dev`.
### Verification/reset emails: MailService is ready; the Nest auth flow doesn't use OTP yet, so wire those when you add email verification.
