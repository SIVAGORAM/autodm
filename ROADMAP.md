# Relayo — product roadmap (to #1)

> The strategy line first: you don't win by feature count. You win by doing the
> wedge (reliability + AI) so well creators can't go back. Parity gets you
> considered; the wedge gets you chosen. Build in waves — launch the core +
> reliability + a couple of AI wins, THEN expand. Don't ship all of this before launch.

## Wave 1 — launch-critical (makes it real, not basic)
Finish core parity + the reliability wedge.
- [ ] Personalization tags (first name + custom fields)
- [ ] Follow-ups (24h window; delay / not-clicked / no-reply)
- [ ] Contacts list + CSV export
- [ ] Email collection + ESP sync (Kit / Mailchimp / Klaviyo)
- [ ] Google sign-in
- [ ] Rich DM blocks (image / video / audio / PDF / cards / quick replies)
- [ ] Story-reply trigger UI (+ story-media picker)
- [ ] Locale pricing (Razorpay) + plan gating in NestJS
- [ ] Token-refresh worker (port from old backend) — tokens die at 60d without it
- [ ] RELIABILITY: live health status · delivery log · break alerts · one-tap reconnect · "test automation"
- [ ] AI intent matching (LLM in the webhook deferral path)

## Wave 2 — differentiate (pull ahead)
- [ ] Conversational AI DM replies (real conversations, not keyword-only)
- [ ] AI lead scoring (Hot / Warm / Cold)
- [ ] Multi-language auto-detect + reply
- [ ] A/B testing of DMs
- [ ] Conversion funnel + revenue attribution analytics
- [ ] Public status / uptime page
- [ ] Templates library + 1-click setup from a post
- [ ] Persistent DM menu + ice breakers
- [ ] Spam / abusive-comment hiding + AI troll detection

## Wave 3 — scale & monetize
- [ ] Agency: team seats, roles, client workspaces, white-label, bulk templates, approvals
- [ ] More than 5 accounts
- [ ] Payment/UPI links + coupons + webinar/booking links in DM
- [ ] Link-in-bio / micro landing pages
- [ ] Facebook Messenger (and later WhatsApp)
- [ ] Integrations: Zapier/Make, Shopify, Google Sheets, HubSpot, Calendly, Notion
- [ ] Outbound webhooks + public API

## Always-on (trust & polish)
- [ ] Smart rate-pacing (stay inside Meta limits, never get flagged)
- [ ] GDPR / data-deletion / consent · audit log
- [ ] Mobile app / PWA · dark mode (tokens ready) · guided onboarding
- [ ] Fast, polished empty/loading/error states everywhere

## The one rule
Every new feature must either (a) strengthen the reliability/AI wedge, or (b) be
asked for by paying users. If it does neither, it waits. That discipline is how
a solo build beats a bloated incumbent.
