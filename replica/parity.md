# Parity report — AutoDM vs SuperProfile Auto-DM (2026-11-18)

Scored from `features.csv` (the recon feature matrix), weighted by priority:
must ×3, should ×2, could ×1. clone `yes`=1, `partial`=0.5, `no`=0. The 3
`skip` rows (storefront/payouts, their branding, their MCP connector) are out of
scope and excluded. No screenshot diff — there's no running instance — so this
is **feature parity**, not pixel parity.

## Score

**Overall: 69%** (49 / 71 weighted)

| priority | parity | yes | partial | no | of |
| --- | --- | --- | --- | --- | --- |
| must   | **88%** | 11 | 1 | 1 | 13 |
| should | 58% | 6 | 2 | 4 | 12 |
| could  | 6%  | 0 | 1 | 7 | 8 |

The core product (must-haves) is essentially there. The gap is in should/could
extras — the breadth SuperProfile has accumulated, most of which is a weekend
each, not architecture.

## The one missing must-have
- **Personalization tags (first name)** — `Hi {{name}}` in the DM. Small: pull
  the commenter's name at send time and template it. Worth doing next; it's the
  single thing dragging must-have parity below 100%.

## Partial (started, not finished)
- **Sign up with Google** — email/password works; Google OAuth pending.
- **Story-reply trigger** — webhook path handles it; picking a specific story in
  the builder is pending.
- **DM block types** — text / image / video / buttons work; audio / PDF / card
  pending.
- **AI intent** — matcher defers correctly; the LLM call isn't wired (your edge —
  worth prioritising over copying their breadth).

## Missing (not started), by cost
Cheap, high-value:
- Instagram contacts list + CSV export (Contact model already there)
- Email collection in the DM
- Locale-priced plans (Razorpay already in the old backend)

Medium:
- Follow-ups within 24h (schema ready; needs the delayed-job scheduler)
- Kit / Mailchimp / Klaviyo sync
- Facebook Messenger automations

Lower priority (could):
- Spam/abusive-comment hiding, lead Hot/Warm/Cold, persistent DM menu + ice
  breakers, story-mention replies, bought/not-bought follow-up conditions

## Out of scope (by design, not a gap)
Storefront + T+1 payouts, the "Sent via" branding, their Claude/MCP connector —
these are theirs to own, not yours to clone (see recon §Out of scope).

## Quality caveats (from bug-report.md)
Parity counts a feature as present if it's built — not that every edge works.
Known correctness gaps behind "yes/partial" rows: the ask-to-follow follower
check uses the wrong Meta API (KNOWN-3), live comments use a different webhook
field (KNOWN-1), and NEXT_POST behaves like ANY_POST (KNOWN-6).

## Honest read
You have a working, tested core at ~88% must-have parity. Don't chase the could
list to raise the number — most of it is breadth a creator won't miss on day
one. The highest-leverage moves: finish personalization tags (closes must-have
parity), wire **AI intent** (where you beat them), then contacts/CSV + follow-ups.
