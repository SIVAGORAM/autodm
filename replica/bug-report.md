# Bug report — AutoDM (self-test pass, 2026-11-18)

Found by a critical review of the code built this session, plus the automated
tests. Two real bugs fixed with regression tests; the rest are documented known
gaps (not regressions) to schedule.

## Fixed

### BUG-1 · Click tracking never counted  — FIXED
`dm-processor.resolveButtons()` ignored its `track`/`links` params and sent the
raw button URL. So `TrackedLink` rows were created but DMs never pointed at the
`/r/:slug` redirect — click counts stayed at 0 and link-not-clicked follow-ups
could never work.
Fix: new pure `automations/dm-blocks.ts` (`extractButtons`, `applyTracking`) now
swaps each tracked URL for `${PUBLIC_URL}/r/:slug?c=<igsid>`. Amazon/Flipkart
links are left as-typed (recon rule). Covered by `dm-blocks.spec.ts` (7 tests).

### BUG-2 · DM and story-reply automations cross-fired  — FIXED
`webhook.onMessage()` matched any incoming message against both `DM` and
`STORY_REPLY` automations, so a DM automation fired on story replies and vice
versa. Fix: classify by `message.reply_to.story` and query only that trigger
type.

## Known gaps (documented, not yet built)

- **KNOWN-1 · Live comments**: the webhook reads the `comments` field only; IG
  delivers live-stream comments on a separate field, so `LIVE_COMMENT` won't
  fire until that field is handled.
- **KNOWN-2 · AI intent not wired**: the matcher returns `needsAi`, but the
  webhook skips non-matches, so `AI_INTENT` never fires. Needs the LLM call in
  the deferral path.
- **KNOWN-3 · Ask-to-follow check is unreliable**: `MetaService.getFollowerInfo`
  uses `business_discovery`, which looks up a public business account, not
  whether the commenter follows you. The gate may wrongly allow/skip. Needs the
  real follower check (or drop the gate until then).
- **KNOWN-4 · IG token refresh**: `refreshLongLivedToken` exists but no cron
  runs it; long-lived tokens expire at ~60 days.
- **KNOWN-5 · Follow-ups**: schema is ready; the delayed-job scheduler (24h
  window) isn't built.
- **KNOWN-6 · NEXT_POST**: currently behaves like ANY_POST (mediaId null); it
  doesn't bind to the actual next published media id.

## Test suite (automated, backend)
20 tests, all passing:
- `matcher.spec.ts` (8) — keyword/any/AI-intent, whole-word, emoji-safe
- `dm-blocks.spec.ts` (7) — button extraction, tracking swap, Amazon/Flipkart no-wrap
- `signature.spec.ts` (5) — Meta HMAC verify: good/tampered/wrong-secret/malformed/no-secret
