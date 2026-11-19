# Test plan — AutoDM

Automated backend tests cover the pure logic (matcher, buttons/tracking,
webhook signature). The flows below need a running app + a Meta test app, so
they're a manual QA checklist. Run them on a staging IG account.

## Automated (run now)
```
cd backend-nest && npm test      # 20 tests
```

## Manual — auth
- [ ] Sign up → cookie set, redirected into dashboard
- [ ] Log in / log out; refresh token rotates (old refresh rejected on reuse)
- [ ] Hitting a protected route with no cookie → 401 → redirect to /login

## Manual — Instagram connect (needs Meta app)
- [ ] Connect → Instagram OAuth → back to /dashboard/instagram?connected=1
- [ ] Account appears; token stored encrypted
- [ ] Free plan: connecting a 2nd account is refused with the cap message
- [ ] Disconnect sets it inactive; it leaves the list
- [ ] Tampered/expired `state` on callback → redirected with an error banner

## Manual — builder (3 steps)
- [ ] Step gating: can't advance without name / keyword / DM text (inline errors)
- [ ] Free plan: paid triggers show "Paid" and can't be selected; >1 keyword blocked
- [ ] Phone preview updates live as you type (reply, DM, buttons)
- [ ] Save draft → status DRAFT; Confirm & launch → status LIVE
- [ ] Button with a label but no URL → blocked at review

## Manual — the core loop (needs Meta app + a real comment)
- [ ] Comment the keyword on the linked post → DM arrives with buttons
- [ ] Public reply appears under the comment (if enabled), rotates across runs
- [ ] Comment again with the same id → no duplicate DM (idempotency)
- [ ] A non-keyword comment → no DM
- [ ] trackClicks on: button points at /r/:slug; clicking it 302s and increments the count
- [ ] Amazon/Flipkart button is sent as-typed (not wrapped)
- [ ] ask-to-follow on + non-follower → DM skipped (see KNOWN-3 caveat)

## Manual — states / a11y (each screen)
- [ ] Empty, loading (skeletons), filled, error render correctly
- [ ] Works at 390px and 1440px
- [ ] Keyboard-only: can complete the builder; visible focus rings
- [ ] No console errors
