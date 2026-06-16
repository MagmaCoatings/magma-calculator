# Magma Calculator — Feature Scoping & Roadmap

Scoping of the five ideas + a design review and general build/longevity feedback. Grounded in the current schema (`src/lib/database.types.ts`) and calculator logic (`src/components/calculator/Calculator.tsx`).

**Headline: all of it is feasible**, and several pieces are already half-built into your data model (`systems.family`, `products.description`, `system_products.coverage_note`). Below: what each feature needs, the schema changes, the UX approach, complexity, and the decisions you need to make.

---

## 1. Installer / Profile information page

### What exists
`profiles` currently has: `id, email, full_name, company_name, role, status`. (An earlier `phone`/`notes` got dropped in the typing rewrite.)

### What to add
Extend `profiles` (or a new `installer_profiles` table — see decision below):
```
first_name        text
last_name         text
company_name      text   (exists)
address_line1     text
address_line2     text
address_line3     text          -- multi-line address: use 3 nullable lines, not one blob
town_city         text
postcode          text
phone             text          -- landline
mobile            text          -- nullable, "if different"
instagram_handle  text          -- store handle, render as @handle + link to instagram.com/handle
facebook_url      text          -- full URL
website_url       text
```
Keep address as **separate fields**, not a single multi-line text box — it makes labels, the future map, and search/sort all work cleanly. You can always render them joined.

### UX
- New route `/profile` (or `/account`) in the installer's logged-in area, with an editable form and a Save button. Reuse the existing form components.
- Light validation: postcode format (UK), URL fields, Instagram handle normalisation (strip a leading `@`/URL, store the handle).
- RLS: installer can read/update **their own** row only; admin can read all (you already have `is_admin()`).

### Admin "copy-paste for labels"
On the admin Users detail page, add a **formatted address block** with a one-click "Copy address" button that yields:
```
First Last
Company Name
Address line 1
Address line 2
Town, Postcode
```
Plus a "Copy all contact details" option (incl. phone/socials). This is the simplest, most reliable approach — better than generating label files, and it works with any label software. (If you later want sheets of labels, a CSV export of selected installers → mail-merge is the natural next step.)

### Map foundation (longer term)
Capturing structured address + postcode now means later you can geocode (postcode → lat/lng) and drop pins on an installer map with zero re-entry. Add nullable `latitude`/`longitude` columns now (populated later) so the map is a pure front-end add-on when you're ready. **No map work needed yet — just don't store the address as one blob.**

**Complexity: Low.** Schema + one form + one admin panel. ~1–2 days.

**Decision needed:** extend `profiles`, or a separate `installer_profiles` table linked 1:1? Recommendation: **extend `profiles`** for now (simpler, one fetch), split out later only if it gets large.

---

## 2. Product tooltips (default ON, per-user toggle, mobile-friendly)

### What exists
`products.description` and `system_products.coverage_note` already hold per-product info — so you have the content fields. Nothing to scrape together.

### Where the toggle state lives
Add to `profiles`: `show_tooltips boolean default true`. Default ON satisfies your requirement; the installer flips it in their profile/account page (alongside feature 1).

### UX — and the mobile/tablet nuance (important)
Hover tooltips don't exist on touch devices, so design **tap-first**:
- Show a small **ⓘ info icon** next to each product/layer name.
- **Desktop:** hover **or** click the icon → popover.
- **Touch:** tap the icon → popover/bottom-sheet; tap elsewhere or an ✕ to dismiss. On phones, a **bottom sheet** reads far better than a floating tooltip.
- Respect the `show_tooltips` setting: when OFF, hide the info icons entirely.
- Keep copy short (1–2 sentences from `description`); link "more" only if needed.

Use a small headless popover (e.g. Radix UI Popover) or a tiny custom one — avoids reinventing positioning/focus/escape handling.

**Complexity: Low–Medium.** One boolean, content already in DB, one reusable `<InfoTip>` component. ~1–2 days incl. mobile polish.

**Decision needed:** tooltip text source — `products.description` (same everywhere) or `system_products.coverage_note` (per-system context)? Recommendation: **fall back** — show `coverage_note` if present, else `description`.

---

## 3. Floor + Wall shared materials (and any multi-surface)

This is the most valuable and the most subtle one. You've identified a real correctness issue.

### What happens today
In `calculate()`, `processProducts()` runs **separately** for floor and wall, and each line is rounded up to whole packs **per surface**:
```
floor Magma 500: ceil(floorArea·coats / coverage) packs
wall  Magma 500: ceil(wallArea·coats / coverage) packs
```
Two materials that are physically the **same product + same colour** get rounded up twice → you over-order. (You already pool pigment globally and the sealer over a combined area — so the pattern exists; it just needs generalising.)

### What it should do
For materials flagged as **shared across surfaces** (same product, same colour, no reason to separate):
1. Sum the *raw* quantity needed across all surfaces (floor + wall + any future surface).
2. Round up to packs **once** on the pooled total.
3. Show it as a single combined line, and **make the saving visible** to the installer, e.g.:
   ```
   Magma 500 Medium — shared (floor + wall)
   95.0 m² total → 5 × 20kg            (floor 84 + wall 11)
   ⓘ Combined because the same product/colour is used on both surfaces
   ```
Materials that are genuinely surface-specific (e.g. a wall-only primer, floor DPM) stay separate with their `(F)`/`(W)` tags.

### How to model "shared"
Add a flag on the product-in-system so admins control it:
```
system_products.shared_across_surfaces  boolean default false
```
…or, cleaner long-term, drive it by **product identity + same colour**: if the same `product_id` appears in both the floor and wall system and the colour matches, pool it. Recommendation: **start explicit** (`shared_across_surfaces` flag, admin-controlled) so behaviour is predictable, then consider auto-detection later.

### Calc change
Refactor `calculate()` so it: (a) gathers raw per-surface quantities, (b) groups by `(product_id, colour, shared?)`, (c) rounds shared groups once and surface-specific items per surface, (d) emits line items with a `scope` label (Floor / Wall / Shared). This generalises to **3+ surfaces** automatically if you key off a surface list rather than hard-coded floor/wall.

### Admin side (also part of your ask)
The current Floor+Wall admin (two independent systems) makes shared materials invisible to the admin. Recommend:
- In `SystemsPage`, when a "both"-type job is configured, show floor and wall stages side by side with a **"shared" toggle** per product, so the admin explicitly says "this microcement is used on both."
- Show a live preview of how a sample job would itemise (shared vs split) so the admin sees the effect before saving.

**Complexity: Medium–High.** The calc refactor is the core work; the admin UX and the "shared" data flag are additive. ~4–6 days. Worth doing carefully — it directly affects quote accuracy.

**Decisions needed:** (a) explicit `shared` flag vs auto-detect by product+colour; (b) wastage on pooled total vs per surface (recommend pooled); (c) how to display the breakdown (tooltip vs always-visible sub-line).

---

## 4. Multiple system types (Microcement, Terrazzo, …) + navigation

### What exists
`systems.family` already exists (defaults to `'Microcement'`) and `build_type` too. So the **data hierarchy is already there** — it's currently just not surfaced in the UI.

### The hierarchy
```
Family (Microcement, Terrazzo, …)
  └─ System / build type (Standard, Belt & Braces, …)   ← systems.build_type
       └─ Surface (Floor / Wall / Both)                  ← systems.surface_type
            └─ Stages → products                         ← stages / system_products
```
Terrazzo simply becomes another `family` with its own systems, stages and products — no structural change, just data. Different option hierarchies per family are already supported because stages/products are per-system.

### Navigation (the real work)
Today the calculator assumes one microcement family. To support several families cleanly:
- Add a **family selector** as the first step ("What are you quoting? Microcement / Terrazzo / …"), then Surface → System → layers as now.
- On mobile this is a clean stepped flow; on desktop a top selector or tabs.
- The product `description`/tooltips and even the unit labels (kg vs m² vs tiles) may differ per family — keep them data-driven (you already store `pack_unit`, `coverage_*` per product), so Terrazzo "just works" if the data is entered.
- Admin: group the Systems admin by `family` (collapsible sections) so it scales as families grow.

**Complexity: Medium.** Mostly UI/navigation + making sure nothing is hard-coded to "microcement". The schema is ready. ~3–5 days. Best done **before** you enter Terrazzo data, so the flow is proven.

**Decision needed:** is "family" the right top level, or do you want "product type" (e.g. Microcement vs Terrazzo vs Resin) as a distinct concept above family? Recommend keeping `family` = the marketing/system line and treating it as the top nav level.

---

## 5. Design refresh — reducing the red/orange

You're right: the current screen leans heavily on orange/red. Selected products (DPM, BondPrime), the Total, the Save button, active toggles and the error state **all** compete in warm reds/oranges, so nothing reads as *the* priority and it feels intense.

### The principle: one accent, used sparingly
Orange is your brand — but a brand colour works best as an **accent**, not a fill for every active element. Recommended direction:

| Element | Now | Suggested |
|---|---|---|
| Brand / logo | Orange | Keep orange |
| Primary CTA (Save Quote) | Orange | Keep orange (the one place it should dominate) |
| Selected product / coat buttons | Solid orange/red | **Neutral slate**: `bg-slate-800 text-white` or a soft `bg-slate-100 border-slate-400 text-slate-900` |
| Surface/system selected | Orange tint | Subtle: `bg-slate-50 border-slate-400` with an orange left-accent or check |
| Total figure | Orange | A strong neutral (near-black) or a single orange highlight on the number only |
| Toggles ON | Green | Keep green (it reads as "included") |
| Errors | Red | Keep red — but it's the *only* red, so it stands out |

Net effect: a calm neutral/white UI (slate + white + lots of breathing room), green for "included", and **orange reserved for the logo and the single primary action**. That makes the Save button and the brand pop *more*, not less.

Two concrete options to choose between:
- **A — "Calm neutral":** slate greys for all selection states, orange only on CTA + logo + the total number. Most professional, closest to tools like Linear/Stripe.
- **B — "Warm minimal":** keep a *little* warmth — selected states in a very soft sand/cream (`bg-orange-50` is fine) with a thin orange border, but drop all the solid orange fills. Still on-brand, less clinical.

Recommendation: **Option A** for a premium, trustworthy quoting tool. Also add more whitespace between cards, slightly larger section headings, and consistent corner radii.

**Complexity: Low** (mostly find-and-replace of utility classes + a palette pass). ~1–2 days. Could do it as a small Tailwind theme token set so future changes are one place.

---

## 6. General build / longevity / design feedback

From the full review + testing across this project:

**Architecture / longevity**
- **Settings are loaded but only partly used** — good that VAT/pigment now read from `settings`; keep going so *all* tunables (coverage rounding, default wastage, etc.) are data-driven, not hard-coded.
- **`Calculator.tsx` is very large** (~1000 lines doing data fetch, calc, and render). As you add families, tooltips and shared-materials, split it: a `useCalculatorData` hook (fetch), a pure `calculateQuote()` module (testable, no React), and presentational components. This is the single best investment for longevity.
- **The calc has no unit tests.** Pricing is the heart of the product — once you extract `calculateQuote()` as a pure function, add tests (floor-only, wall-only, both, shared materials, rounding edges). This protects you every time you touch pricing.
- **Schema lives in ad-hoc `sql/` files.** Move to Supabase CLI migrations so the DB is reproducible and matches `database.types.ts`. Regenerate types with `supabase gen types` rather than hand-editing.
- **No CI / error boundary** (still). Add a GitHub Action running `npm run build` on PRs, and a top-level React error boundary so a render error doesn't white-screen an installer mid-quote.

**Product / UX**
- **Quote output**: installers will want a branded **PDF** (not just copy-to-clipboard) — likely a near-term ask once they're saving quotes.
- **Pricing transparency**: the shared-materials work (feature 3) is a chance to show *how* a quote is derived (area × coverage × coats → packs) — installers trust a calculator they can follow.
- **Offline resilience**: the error UI is good; consider a faster timeout so a dropped connection surfaces in ~3s rather than ~10s.

**Performance** (minor at current scale): memoise `calculate()`/`getLayersByStage`; the focus-refresh only refetches the single-surface system (not both in Floor+Wall) — fine, but note it.

---

## Suggested phasing

| Phase | Items | Why first |
|---|---|---|
| **1** | Design refresh (#5) + Installer profile (#1) + Tooltips (#2) | High value, low risk, mostly additive; improves the impression immediately and starts gathering installer data. |
| **2** | Multi-system navigation (#4) | Do *before* entering Terrazzo data so the flow is proven; unblocks new product lines. |
| **3** | Shared-material calc (#3) | Highest-value correctness work; do once the calc is extracted to a testable module (see #6) so you can test it properly. |
| **Ongoing** | Refactor `Calculator.tsx` + tests + migrations + CI (#6) | Underpins everything above; tackle the extraction before #3. |

---

## Decisions I need from you
1. **Profile data**: extend `profiles` or a separate `installer_profiles` table? (Rec: extend.)
2. **Shared materials**: explicit admin flag per product, or auto-detect by same product+colour? (Rec: explicit first.)
3. **Design**: Option A (calm neutral) or B (warm minimal)? (Rec: A.)
4. **Top-level navigation**: is `family` (Microcement/Terrazzo) the right top level? (Rec: yes.)
5. **Quote PDF**: in scope soon, or later?

Answer those and I can turn any phase into a concrete, paste-ready dev brief (schema migration + component plan), the way we've been doing.
