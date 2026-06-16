# Magma Calculator — detailed design audit & fix instructions
## Desktop · Tablet · Mobile — sampled live from the running app + source

**How this was checked:** live colour sampling in the browser + reading the actual classes in `src/components/calculator/Calculator.tsx`, `src/components/layout/Header.tsx` and `src/index.css`. (Note: this machine can't render a sub-1329px viewport, so the mobile/tablet section is audited from the responsive code, which is what actually controls the behaviour — not guesswork.)

---

## 0. What is ALREADY correct — do not undo
The implementation is largely faithful. Confirmed live:
- Page background = limestone `#ECE8E1` (warm) ✓
- Cards = bone `#FBFAF7` (warm) ✓
- Font = Inter ✓
- Section labels = stone `#6F6B64`, 12px/500, uppercase, tracked ✓
- Selections = basalt `#211F1D` (Surface, Build type) ✓
- Toggles = sage ✓
- Total has the underline accent ✓
- **Mobile already built:** sticky bottom total bar (`Calculator.tsx` L1214), bottom tab-nav (`Header.tsx` L106), 44px touch targets, `pb-32` to clear the bar ✓

So this is a **polish pass, not a rebuild.** Three areas: (1) the orange hue, (2) a handful of premium-feel deltas, (3) mobile refinements.

---

## 1. 🔴 THE main problem — the orange hue
`src/index.css`:
```
--color-molten: #F58E25;      /* too bright / yellow — looks cheap */
--color-molten-ink: #C97210;
--color-molten-tint: #FEF3E2;
```
This one value drives the Save button, the total underline (L52), the active-nav tint and the retry button — so it dominates the screen and undercuts the premium feel.

**Action — use the exact logo orange.**
> **Jason: drop the logo into `public/magma-logo.svg`** (or `.png`). I'll sample the precise hex and finalise these three tokens + the ring SVG. Everything keys off this.

**Interim values until the logo is sampled** (deeper, less yellow — closer to the logo amber):
```
--color-molten: #DE7A1A;
--color-molten-ink: #B5610E;   /* for orange TEXT/figures — passes contrast on bone */
--color-molten-tint: #FBF0E4;
```
Do not ship the final without the sampled hex — the brand orange must match the logo exactly.

---

## 2. Premium-feel deltas (why it still reads a bit flat)

### 2a. Contrast — cards barely separate from the page
Limestone `#ECE8E1` and bone `#FBFAF7` differ by only ~6% lightness, so cards float on a same-toned beige and the screen looks washed. **Fix (pick one):**
- Keep bone cards but **deepen the page bg** to `#E7E2D9` for clearer separation, **or**
- Keep the page and make **cards pure-white-warm `#FFFFFF`** with the bone reserved for inner sub-cards.
Either way, ensure every card keeps the hairline `border-line` (#E4DFD7) so edges are crisp.

### 2b. The two solid-black segmented controls feel heavy
Surface and Build type are full-width controls with a large solid-black selected segment — two black bars stacked. **Recommended refinement — iOS-style inset segmented control** (lighter, more premium than a black fill):
- Track: `bg-limestone` (inset), `rounded-lg`, `p-1`.
- Selected segment: `bg-bone text-basalt` raised pill + a thin `shadow-sm` + `font-medium`.
- Unselected: transparent, `text-stone`.
This keeps basalt as the "ink" but removes the heavy black blocks. (If you prefer the solid-basalt look from the mockup, keep it — but this is the single biggest "premium" upgrade on desktop.)

### 2c. Page header is plain
`L831`: `<h1 class="text-xl …">Magma Calculator</h1>` centered + subtitle. The logo already says MAGMA, so this is redundant and template-y. **Fix:** drop the centered title block, or replace with a left-aligned, larger, lighter treatment (`text-2xl font-medium` + a thin stone subtitle), and add more top spacing. Reclaims premium real estate.

### 2d. Whitespace / density
Cards use `gap-6`. Bump section spacing to `gap-8` on desktop and increase card inner padding to `p-5`. Premium = air.

### 2e. Total hierarchy
`L1175`: total is `text-2xl` (24px). Make it the hero: `text-3xl`/`text-[28px]`, basalt, with the (corrected) molten underline only under the figure. Subtotal/VAT stay small stone.

### 2f. Remove tinted-box noise
The "Pallet / Delivery Costs: TBC" and "Cost per m²" tinted boxes add visual clutter near the total. Make "Cost per m²" a plain stone line (no fill); make the delivery note a single small stone line, not a tinted card.

---

## 3. Section-by-section (desktop) — exact targets

| Section | Current | Target |
|---|---|---|
| Top nav | OK; active "Calculator" = bright molten-tint | Use corrected molten-tint `#FBF0E4`; active icon corrected molten |
| Page header (L830–832) | `text-xl` centered title + subtitle | Drop or restyle (see 2c); add top spacing |
| Surface type (L842/865) | solid basalt segment | inset segmented (2b); keep basalt as ink |
| Area inputs (L890/904/917) | bone, border-line, 44px ✓ | add `text-base` (16px) to kill iOS zoom (see §4) |
| Build type (L939/966) | solid basalt ✓ | match Surface treatment (2b) |
| Layer cards (L638) | `bg-bone border-line` ✓ | keep; ensure `p-5`, `gap` between cards |
| Product chips / coats | outlined basalt ✓ | keep |
| Materials panel (L1122) | bone card, `shadow-sm` ✓ | keep; align number column |
| Total (L1175) | `text-2xl` + underline | `text-3xl`, corrected underline (2e) |
| Save button (L1203/809) | `bg-molten #F58E25` | corrected molten; `min-h-12` ✓ |
| Colour swatches (L1047) | `border-basalt scale-110` | ensure ≥44px on mobile (see §4) |

---

## 4. 📱 Mobile (audited from code — `lg` breakpoint = 1024px)

### Already done (credit)
- **Sticky bottom total bar** — `L1214` `fixed bottom-0 … lg:hidden safe-bottom z-50` ✓
- **Bottom tab nav** — `Header.tsx` `L106` `fixed bottom-0 … lg:hidden` ✓
- **Touch targets** — `min-h-[44px] min-w-[44px]` on coats/pills/inputs ✓
- **`pb-32 lg:pb-6`** clears the sticky bar ✓

### Refinements needed
1. **Inputs cause iOS zoom.** The area/wastage inputs (L890/904/917) have no explicit font-size → Tailwind default ~14px → iOS auto-zooms on focus (jarring). **Add `text-base` (16px) to all inputs.** Also set `inputMode="decimal"` for the numeric keypad.
2. **Two stacked black segmented controls eat vertical space** on a phone (Surface + Build type each full-width). The inset segmented (2b) is shorter and lighter — helps a lot on mobile.
3. **Colour swatches**: confirm they render ≥44px on mobile (L1047 area). If they're `w-8 h-8` (32px) they're too small for thumbs — bump to `w-11 h-11` on base, can shrink at `sm`.
4. **Bottom tab-nav active state**: make the active tab use corrected molten-tint + molten icon (not the bright orange). Verify it doesn't overlap the sticky total bar — if both are `fixed bottom-0`, they'll collide. **Check:** the total bar and the tab-nav must stack (total bar sits *above* the tab bar, e.g. `bottom-16`), or the calculator's Save lives in the total bar and the tab-nav is hidden on the calculator screen. This is the most likely real mobile bug — verify on a device.
5. **Tooltips** (`InfoTip`): on `< md`, open as a **bottom sheet**, not a floating popover.
6. **Header**: on mobile the top bar should show just logo + hamburger/account; nav lives in the bottom tab bar. Confirm no cramped top nav.
7. **Safe areas**: `safe-bottom` is used ✓ — ensure it maps to `env(safe-area-inset-bottom)` in CSS.

### Mobile QA matrix (test on real devices / DevTools device mode)
iPhone SE (375) · iPhone 15 (393) · Pixel (412) · iPad portrait (768) · iPad landscape (1024). Check: **no input zoom**, total bar + tab bar don't overlap, tap targets, bottom-sheet tooltips, single→two column at 1024, no horizontal scroll.

---

## 5. Tablet (768–1024)
- The main grid is `lg:grid-cols-[1fr_340px]` (L854) → below 1024 it's **single column** with the **sticky bottom total bar** covering the price. So **iPad portrait (768) is now handled** (the bar means the total is always visible) ✓. Good.
- iPad landscape (≥1024) gets the two-column sticky side panel ✓.
- Just verify the sticky bottom bar / tab-bar overlap (point 4.4) on iPad portrait too.

---

## 6. Verification & acceptance
```bash
grep -n "F58E25" src/index.css      # → replaced with logo hex (or interim #DE7A1A)
grep -n "bg-molten " src/**/*.tsx   # → only Save/New-quote CTA + retry; nothing else
```
- [ ] Brand orange = exact logo hex (after `public/magma-logo.svg` dropped). No `#F58E25`.
- [ ] Cards visibly separate from the page (contrast fix 2a).
- [ ] Segmented controls use the inset style (or intentionally keep basalt) — consistent across Surface + Build type.
- [ ] Header restyled / decluttered; total is `text-3xl` hero.
- [ ] Inputs `text-base` (no iOS zoom) + `inputMode`.
- [ ] Mobile: total bar and tab-nav do **not** overlap; swatches ≥44px; tooltips are bottom sheets.
- [ ] `npx tsc -b` green.

---

## Priority order
1. **Drop the logo → fix the orange** (biggest single visual win).
2. Contrast (2a) + inset segmented controls (2b) — the two changes that move it from "fine" to "premium".
3. Header declutter (2c) + total hero (2e) + remove tinted boxes (2f).
4. Mobile: inputs `text-base`, verify total-bar/tab-bar overlap, swatch size, tooltip bottom sheet.

The bones are right — this is the last 10%. The orange is 60% of the perceived problem; get the logo to me and I'll lock it precisely.
