# Magma Calculator — Review of current codebase (16 Jun 2026)

Reviewed the working copy at HEAD `12955eb` plus uncommitted changes. A lot has landed since the roadmap — much of Phase 1 and the start of Phase 3.

## Headline
Strong progress, but **the build is currently red (4 TypeScript errors)** and there are **two correctness gaps that will bite at runtime**: missing database migrations for the new columns, and two conflicting shared-material code paths. None are hard to fix, but they need doing before this is shippable.

---

## What's new and good (credit where due)
- **Installer profile page** (`ProfilePage.tsx`) — fields match the scope: first/last name, 3 address lines, postcode, mobile, Instagram handle, Facebook/website URLs, plus `show_tooltips`. Address kept as separate fields ✓.
- **Tooltips** (`InfoTip.tsx`) — info icon with hover (desktop) + tap (mobile) + an ✕ close on small screens, responsive width. Sensible.
- **Quote PDF** (`QuotePDF.tsx`) — real PDF export via `@react-pdf/renderer`. A roadmap item, done early.
- **Activity log** (`ActivityLogPage.tsx`, `activityLog.ts`), **pagination**, **error boundary** (`ErrorBoundary.tsx`), and **CI** (`.github/workflows/ci.yml`) — all from the longevity list.
- **RLS security fixes** (`sql/rls_security_fixes.sql`) — A1 (quotes `created_by`), A2 (systems-table RLS), A3 — written out cleanly.
- **Shared-materials calc** — a proper two-pass approach exists (more below): shared products are computed on the *combined* floor+wall area and rounded once, with a ✦ badge and a "floor + wall combined" label. That's exactly the right idea.

---

## 🔴 Critical issues

### 1. Build is broken — 4 TypeScript errors
```
Calculator.tsx(101,9)  TS6133  'filteredSystems' declared but never read
Calculator.tsx(546,11) TS6133  'consolidated' declared but never read
SystemsPage.tsx(3,32)  TS6133  'logDelete' imported but never read
SystemsPage.tsx(356,20) TS2345 'shared_across_surfaces' missing in object assigned to SystemProductForm
```
`npm run build` fails. The first three are dead/unused; the fourth is a form-reset object missing the new field (`shared_across_surfaces: false`). Your new CI will (correctly) block this — good that it's there.

### 2. Missing DB migrations for the new columns (will fail at runtime)
The code reads/writes columns that are **not in `database.types.ts` and have no SQL migration anywhere in `sql/`**:
- **`profiles`**: `first_name, last_name, address_line1, address_line2, address_line3, postcode, mobile, instagram_handle, facebook_url, website_url, show_tooltips` — `ProfilePage.tsx` does `.from('profiles').update({...})` with these. If the columns don't exist in Supabase, **saving a profile returns a 400 "column does not exist"** and the feature is dead.
- **`system_products.shared_across_surfaces`**: read in `Calculator.tsx` and written in `SystemsPage.tsx`, but not in the schema/types — so the admin can't persist the shared flag and the calc reads `undefined`.

You need ALTER TABLE migrations for both, then regenerate types (`supabase gen types`). Draft:
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS address_line3 text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS instagram_handle text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS show_tooltips boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

ALTER TABLE public.system_products
  ADD COLUMN IF NOT EXISTS shared_across_surfaces boolean NOT NULL DEFAULT false;
```
(Confirm the existing "Users can update own profile" policy still allows these — it does, since it only restricts `role`/`status`.)

### 3. Two conflicting shared-material code paths
`calculate()` currently does the work twice, and they fight:
- **Path A (correct):** the two-pass `processProducts(...)` — shared products use `combinedAreaWithWastage` and round once; non-shared get `(F)`/`(W)` and per-surface areas. Produces nicely-labelled `items` (✦, "floor + wall combined").
- **Path B (leftover):** after that, a name-based `productMap` consolidation re-merges items by stripped base name, **sums already-rounded packs**, and rewrites the qty to `"{n} units"`. The render uses `sortedItems` from **Path B**, not Path A.

Consequences: Path B clobbers Path A's clear labelling (you lose the "floor + wall combined" / m² detail, replaced by "X units"), and it merges **any** same-named product across surfaces by summing rounded packs — which is the *over-ordering* behaviour the shared flag was meant to prevent, now applied indiscriminately. The dead `consolidated` array (build error #2) is a remnant of this half-finished migration.

**Fix:** delete Path B (the `productMap`/`consolidated`/`sortedItems` block) and return the two-pass `items` directly (sorted). Keep only the flag-driven approach.

---

## Quality notes (non-blocking)
- **QuotePDF font**: `Font.register({ family:'Helvetica', src: 'https://fonts.cdnfonts.com/...woff' })` — `@react-pdf/renderer` ships Helvetica built-in and needs **TTF** (not WOFF) for custom fonts; this remote registration can fail or slow PDF generation. Drop the `Font.register` and use the built-in Helvetica.
- **`Calculator.tsx` is now 1,221 lines** doing fetch + calc + render. The shared-material bug above is a direct symptom. Strongly recommend extracting a pure `calculateQuote()` module now and unit-testing it (floor / wall / both / shared / rounding) — before adding Terrazzo and more surfaces.
- **`@react-pdf/renderer` (+~1MB)** is now a dependency — fine, but lazy-load the PDF route so it doesn't bloat the main bundle.
- **InfoTip** opens on `onMouseEnter` but only closes on click/✕ or `setIsOpen(false)` — verify it also closes on mouse-leave/outside-click on desktop so tips don't get stuck open.

## Security
`rls_security_fixes.sql` is correct and covers the A-items from the scope — but, as before, it's a file: **run it in Supabase** and re-test (non-admin can't see others' quotes; systems tables enforce admin-write). The new profile columns inherit the existing self-update policy, which is fine.

## Still open from earlier
- **Design refresh (#5)** — still orange-heavy; not started.
- **Schema discipline** — new columns are being added in code ahead of the DB; move to proper migrations so this class of "column doesn't exist" bug stops recurring. This is now the #1 process issue.
- **No tests on the calc** — increasingly risky as the calc grows.

---

## Recommended immediate order
1. **Write + run the migrations** (profiles + `shared_across_surfaces`), regenerate types. *(Unblocks profile + shared flag.)*
2. **Fix the 4 build errors** — incl. removing shared-material **Path B** and the dead `consolidated`. *(Green build / CI.)*
3. **Re-test**: profile save round-trips; a "both" quote with a shared product shows one combined line rounded on the pooled area; PDF renders.
4. Then resume Phase plan (design refresh next).

The direction is good and the feature breadth is impressive — the gap is the recurring **code-ahead-of-schema** pattern and a half-finished refactor. Tighten those two and you're in good shape.
