# Frontend architecture

## Runtime and routing

The frontend is a Next.js 15 App Router application with React 18 and TypeScript. Route groups organize authentication and dashboard pages without appearing in URLs.

| Route | Purpose |
|---|---|
| `/` | Public landing page with product explanation, pricing, FAQ, and signup links |
| `/login`, `/signup`, `/verify` | Account access and email verification |
| `/forgot-password`, `/reset-password` | Password recovery |
| `/dashboard` | Overview and account/automation summary |
| `/dashboard/automations`, `/dashboard/automations/new`, `/dashboard/automations/:id`, `/dashboard/automations/:id/edit` | Automation list, account-aware creation, details, and configuration editing |
| `/dashboard/instagram` | Account connection, media, and disconnect controls |
| `/dashboard/analytics`, `/dashboard/logs` | Basic run/click metrics and delivery rows |
| `/dashboard/contacts` | Searchable, account-filtered contact inbox with CSV export |
| `/dashboard/admin/webhooks` | Admin-only dead-letter review and explicitly confirmed webhook redrive |
| `/dashboard/admin/mail` | Admin-only redacted transactional email queue and failure status |
| `/dashboard/admin/support` | Admin-only support/feedback inbox with status filters and customer replies |
| `/dashboard/billing` | Plan catalogue, usage, and checkout |
| `/dashboard/notifications`, `/dashboard/settings`, `/dashboard/help`, `/dashboard/help/email-us`, `/dashboard/feedback` | Account/help surfaces; notifications are a live account/automation status snapshot, while support and feedback submit persisted API threads |
| `/dashboard/campaigns*` | Legacy aliases that redirect to automation routes |

The dashboard layout fetches `/api/auth/me`, redirects unauthenticated users to login and unverified users to `/verify`, and supplies responsive navigation. The verification route can inspect current OTP outbox state, explain session expiry, and link back to login. Authentication is enforced again by the API; the client route checks are only a user experience layer.

## State and API access

- TanStack Query owns remote query state with a 15-second default stale time, focus/reconnect refresh, and limited retries. Live operational views poll while visible: automation lists and contacts refresh about every 15 seconds; dashboard worker status refreshes every 15 seconds; support threads and billing subscription status refresh every 30 seconds; other metrics and statuses use page-specific intervals.
- The dashboard keeps HTTP polling (suspended in background tabs) and also opens an authenticated Server-Sent Events stream. Processed Instagram webhook events invalidate account, automation, run, contact, and worker-status queries; terminal DM delivery events invalidate delivery, automation, analytics, log, contact, subscription, and worker-status queries; successful automation mutations, verified billing entitlements, Instagram account/webhook actions, and contact note/tag edits publish their own invalidations for other open dashboard tabs. Polling and focus/reconnect refresh remain the fallback. The authenticated stream and keepalive were observed in Chrome; a Redis invalidation reaching a second browser tab and a Meta webhook-to-worker delivery have not been verified end to end.
- The Notifications page combines automation health with Instagram token expiry, refreshes status periodically, and reports incomplete API reads instead of displaying an all-clear. It is not a persisted inbox and has no unread state.
- Zustand persists the profile summary and an authenticated flag in browser storage. It does not persist the access token; the browser sends HTTP-only cookies.
- `frontend/services/api.ts` creates an Axios client with credentials, a 15-second timeout, and a response interceptor that tries refresh once after a non-auth 401. Auth endpoints do not automatically refresh; the verification page explains an expired session and links to login.
- The frontend and API may be on separate origins. Production cookies use `SameSite=None; Secure`; backend mutation requests validate the `Origin` against configured app origins.
- Plan, automation, support, and feedback data are fetched from the active Nest API. Legacy campaign, profile-picture, and notification API client methods still require endpoint verification before use.

## UI and design system

The landing page uses local Inter fonts, custom CSS in `app/globals.css`, brand assets under `public/`, and hand-built sections. The dashboard mixes `components/rl-kit.tsx` styling with `components/ui/primitives.tsx` Tailwind-based primitives. Theme switching uses `next-themes`; the dashboard shell includes a mobile drawer and responsive breakpoints.

The automation builder fetches the user's active Instagram accounts and requires a selected target before creating an automation; backend ownership and plan-cap checks remain authoritative. Form payloads are ultimately validated by backend Zod schemas. An authenticated local browser session has been observed on Overview and Instagram: the account renders, and the Instagram page reports that its account webhook subscription is not confirmed. This is not a full dashboard acceptance run; systematic route-by-route, responsive, and accessibility audits remain open. There are two UI primitive systems, which can drift. The public footer links to the Terms, Privacy, and Refund draft pages; replacing and approving their contents remains a launch blocker.

## Rendering, metadata, and performance

The landing and most routes prerender statically; automation detail/edit routes use dynamic route params, while dashboard client queries fetch private data after hydration. Local fonts avoid runtime font CDN dependencies. The latest checked production build emitted all 44 routes and reported roughly 103 kB of shared first-load JavaScript. No real-device responsive, Core Web Vitals, screen-reader, authenticated-flow, or end-to-end invalidation measurements have been collected.

The build script runs ESLint before `next build`; the Next 15 embedded lint step is disabled because it misreads the ESLint 9 flat config. Next image remote host configuration is limited to Instagram image hosts. Metadata is currently generic; policy pages and complete social preview metadata need product-owner review.
