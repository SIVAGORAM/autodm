# Design system — AutoDM

Clean-room and original: fresh palette and component specs, none of
SuperProfile's colours, assets or copy. Same token structure as the existing
frontend (shadcn + HSL CSS vars) so it drops in with no refactor.

## Direction
Confident, modern SaaS. **Teal primary** (trust + "conversations"), **coral
accent** for the one action that matters on a screen, neutral slate greys.
Distinct from Instagram's gradient and from the generic shadcn violet the repo
ships with today.

- Source of truth: `tokens.json`
- Drop-in CSS: `globals-vars.css` (replaces the `:root` / `.dark` blocks in `frontend/app/globals.css`)

## Palette (light)
- primary `teal 178 70% 30%` — primary buttons, active nav, links, focus ring
- accent `coral 14 90% 58%` — one per screen max (the "Publish" / main CTA)
- success / warning / destructive — status only, never decoration
- foreground `200 24% 12%`, muted-foreground `200 12% 42%` on muted surfaces
Both modes meet WCAG AA for text and UI (primary/accent on white ≥ 4.5:1; check
new pairings before shipping).

## Type
Inter. Scale xs→4xl (see tokens). Weights: 600 for headings/buttons, 500 for
labels, 400 body. Numbers in stat tiles: 3xl semibold.

## Radius / shadow / motion
Base radius 0.625rem (cards, inputs, buttons). Shadows sm/md/lg only. Motion
120–260ms, standard ease. No value is raw in a component — reference the token.

## Components (maps to recon's component list)

- **Button** — variants: primary (teal), accent (coral, max one/screen),
  secondary (muted), ghost, danger, locked (paid: lock icon + muted). States:
  default/hover/focus(ring)/disabled/loading. Radius md, h-10, px-4, weight 600.
- **Stepper (3-step)** — numbered dots joined by a line; current = primary fill,
  done = primary check, upcoming = muted. Used in the builder (S06–S08).
- **Trigger option card** — icon + title + one-line desc; selected = primary
  border + tint; locked = lock badge, opens the upgrade modal.
- **Keyword tag input** — chips with an × ; "cap reached" helper text on free
  plan (one keyword); Enter / comma to add.
- **Toggle** — track muted → primary when on; locked variant shows a lock.
- **Message block editor** — stacked blocks (text / image / video / buttons /
  card); drag handle, add-block menu, per-block delete; inline validation.
- **DM button editor** — label (≤20 chars) + URL; invalid-URL error; max 3.
- **Follow-up step row** — condition select + delay input + delete; "within 24h"
  helper.
- **Phone preview** — device frame showing comment → public reply → DM with
  buttons; the review step (S09).
- **Stat tile** — label (sm muted) + value (3xl semibold) + optional delta;
  zero-state shows "—". Analytics colours come from the chart tokens (run the
  dataviz skill when building the charts).
- **Automation card/row** — name, trigger chip, status pill (live=success,
  paused=warning, draft=muted), runs count, kebab menu.
- **Data table** (contacts) — sticky header, zebra off, empty + loading
  (skeleton rows) states.
- **Toast** — success/error, top-right, auto-dismiss.

## Rules
- One coral accent action per screen; everything else teal or neutral.
- Status colours mean status, never style.
- Every surface has empty / loading / error. Loading = skeletons, not spinners.
- Focus ring visible on every interactive element (keyboard reachable).
