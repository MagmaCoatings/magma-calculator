# Magma Calculator — Design System Implementation Brief
## "Refined Mineral" — mobile-first

A complete, paste-ready brief to apply the new look. Stack: React 18 + Tailwind **v4** + Vite. **Mobile is the primary platform** — most installers quote on phones, so every component spec below leads with the phone.

> ⚠️ **Before starting:** drop the logo into `public/magma-logo.svg` so the exact brand orange can be sampled. This brief uses a **placeholder `#EE7D1A`** for the brand orange — replace every instance with the sampled hex once the file is in. One canonical orange, used everywhere.

---

## 1. Design tokens (Tailwind v4 — CSS-first)

Tailwind v4 is configured in CSS, not `tailwind.config.js`. In `src/index.css`:

```css
@import "tailwindcss";

@theme {
  /* Brand */
  --color-molten: #EE7D1A;        /* PLACEHOLDER — replace with sampled logo hex */
  --color-molten-ink: #C2640E;    /* ~12% darker — for orange TEXT/figures on light bg (contrast) */
  --color-molten-tint: #FBEFE3;   /* active-nav / soft wash */

  /* Mineral neutrals */
  --color-basalt: #211F1D;        /* primary text, selected states, dark surfaces */
  --color-ink: #3A3833;           /* body text */
  --color-stone: #6F6B64;         /* secondary text / labels */
  --color-ash: #A8A39B;           /* hints, muted icons */
  --color-line: #E4DFD7;          /* hairline borders */
  --color-line-soft: #F0ECE4;     /* inner dividers */
  --color-bone: #FBFAF7;          /* cards */
  --color-limestone: #ECE8E1;     /* page background */

  /* Semantic */
  --color-sage: #5F6B57;          /* "included" toggles, success */
  --color-sage-tint: #EAEFE5;
  --color-danger: #A33223;        /* errors — the ONLY red */
  --color-danger-tint: #F6E9E6;

  --radius-card: 12px;
  --radius-control: 9px;
}
```

This auto-generates utilities: `bg-bone`, `text-stone`, `border-line`, `bg-molten`, `text-basalt`, etc. **Remove all hard-coded `orange-*`, `blue-*`, `gray-*` and `#EA580C` usages** and replace with these tokens (map in §6).

---

## 2. Typography
- Adopt one premium sans. Recommended: **Inter** or **Geist** (free). Add via `@fontsource` or a `<link>`; set `--font-sans` in the `@theme`.
- Weights: **400 and 500 only** (no 600/700 — heavy looks cheap).
- Scale: page title 20px/500, section label 12px/500 `text-stone` (slight tracking), body 14px, hints 12px `text-ash`.
- **The total is the hero**: 26–28px/500 `text-basalt`, with a 3px `border-b border-molten` accent under the figure.
- Sentence case everywhere except the `MAGMA` wordmark.

---

## 3. Brand assets — ring logo + spinner

Create `src/components/brand/MagmaMark.tsx` (sample the real arcs from the dropped SVG; this is the geometry to match):

```tsx
export function MagmaMark({ size = 28, withLetter = true }: { size?: number; withLetter?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label="Magma" role="img">
      <path d="M18.5 3.4 A 16.6 16.6 0 0 0 18.5 36.6" fill="none" stroke="var(--color-molten)" strokeWidth="3.4" strokeLinecap="round"/>
      <path d="M21.5 3.4 A 16.6 16.6 0 0 1 21.5 36.6" fill="none" stroke="var(--color-ash)" strokeWidth="3.4" strokeLinecap="round"/>
      {withLetter && <text x="20" y="27" textAnchor="middle" fontSize="18" fontWeight="500" fill="#8E8980">M</text>}
    </svg>
  )
}

export function MagmaSpinner({ size = 28 }: { size?: number }) {
  // same two arcs, no letter, wrapped in animate-spin
  return <div className="animate-spin"><MagmaMark size={size} withLetter={false} /></div>
}
```

Replace the current generic spinner everywhere (loading states, ProtectedRoute, button busy states) with `<MagmaSpinner/>`. Free brand cohesion.

---

## 4. Component specs (mobile-first)

### App shell
- `<body>`/root: `bg-limestone text-ink`.
- Cards: `bg-bone border border-line rounded-[var(--radius-card)]`. **No shadows** (at most one very soft `shadow-sm` on the sticky summary bar so it lifts off content).

### Navigation
**Active state rule (all nav):** soft amber tint + amber icon + basalt label — never a solid orange fill.
- Active item: `bg-molten-tint`, icon `text-molten`, label `text-basalt`.
- Inactive: icon `text-ash`, label `text-ink`.
- **Admin sidebar (desktop/tablet):** keep the icon list; active item is a tinted pill. Collapses to a slide-over drawer on mobile (hamburger).
- **Installer top bar:** logo + wordmark left; icon+label items; on mobile, labels hide (`hidden sm:inline`) leaving icons — already partly done.

### Buttons
- **Primary (Save quote / New quote):** `bg-molten text-white rounded-[var(--radius-control)]`, min-height 48px on mobile. The only solid-orange element.
- **Secondary:** `bg-bone border border-basalt text-basalt`.
- **Ghost:** `text-ink hover:bg-line-soft`.

### Selection pills (surface / system / coats)
- Selected: `bg-basalt text-bone` (dark — NOT orange).
- Unselected: `bg-white border border-line text-ink`.
- Min tap height **44px** mobile.

### Toggles (include / pigment / tooltips)
- On: track `bg-sage`. Off: `bg-ash`. Knob white. Hit area ≥44×44.

### Inputs (area, wastage, profile fields)
- `bg-white border border-line rounded-[var(--radius-control)]`, focus ring `ring-2 ring-molten/30`.
- **Mobile critical:** `font-size: 16px` minimum (prevents iOS auto-zoom on focus), min-height 44px.
- Numeric fields: `inputMode="decimal"` + `type="number"` so phones show the number pad.

### Status badges (quotes)
- Approved: `bg-sage-tint text-sage`. Sent: `bg-molten-tint text-molten-ink`. Draft: `bg-line-soft text-stone`. Pill shape, 11–12px.

### Tables / list rows
- Desktop: hairline-separated rows.
- **Mobile: tables become stacked cards** (reference + total on row 1, client + status on row 2) — never a horizontally-scrolling table on a phone.

### Total / summary
- Line items hairline-separated; subtotal/VAT in `text-stone`; **Total** large `text-basalt` with `border-b-[3px] border-molten` under the figure; per-m² in `text-ash`.

### Colour picker → finish swatches
- Swatches **≥44×44px** on mobile (currently ~32px — too small for thumbs). Selected = `outline-2 outline-basalt outline-offset-2`. Goal: replace flat hex chips with real **finish thumbnails** when imagery is available.

---

## 5. Find-and-replace map (current → new)

| Current | New |
|---|---|
| `bg-blue-50 border-blue-500 text-blue-700` (selected) | `bg-basalt text-bone border-0` |
| `bg-blue-600 text-white` (selected) | `bg-basalt text-bone` |
| `text-magma` / `#EA580C` brand text | `text-molten-ink` |
| orange fills on toggles/coats | basalt (selection) / sage (toggle on) |
| `bg-gray-50` page | `bg-limestone` |
| `bg-white` cards | `bg-bone` |
| `border-gray-200` | `border-line` |
| `text-gray-500` | `text-stone` |
| `text-gray-400` | `text-ash` |
| green toggle | `bg-sage` |
| primary CTA orange | `bg-molten` (unchanged role, exact hex from logo) |

Do this as a centralised pass; afterwards grep for `blue-`, `orange-`, `gray-`, `#EA580C` → should be zero in components.

---

## 6. 📱 Mobile & responsive — the priority

### Breakpoints
- Base = phone (design here first). `sm` 640, `md` 768 (tablet portrait), `lg` 1024 (desktop two-column).

### 6.1 Sticky bottom summary bar (the single most important mobile add)
Below `lg`, the materials/total currently sits at the **bottom** of a long scroll — the installer can't see the price while configuring. Add a **pinned bottom bar**:
- Fixed to viewport bottom, full width, `bg-bone border-t border-line shadow-sm`.
- Shows running **Total** (basalt, with molten underline) + a **"View materials"** button that opens the full breakdown as a **bottom sheet**.
- Respect iOS safe area: `padding-bottom: env(safe-area-inset-bottom)`.
- Hidden at `lg` (the sticky side column takes over).
- Primary "Save quote" lives in the bottom sheet / bar so it's always in thumb reach.

### 6.2 Mobile navigation
- Top bar collapses to logo + hamburger; nav opens as a slide-over with the icon list (active = amber tint).
- Consider a **bottom tab bar** (Calculator / Quotes / Profile) for installers — thumb-reachable, app-like, premium. Admin stays a drawer.

### 6.3 Touch targets — audit to ≥44×44px
Currently too small: **colour swatches (~32px)**, coat buttons, the info "ⓘ" icons, toggle hit areas. Pad them out. This is the most common mobile-usability failure in the current build.

### 6.4 Inputs on phones
- `font-size ≥16px` (no iOS zoom), `min-height 44px`, `inputMode`/`type` set for numeric pads, generous spacing so fat-finger taps don't hit the wrong field.

### 6.5 Tooltips → bottom sheet on mobile
Hover doesn't exist on touch. The `InfoTip` should, below `md`, open as a **bottom sheet** (title + 1–2 lines + close) rather than a floating popover. Tap ⓘ to open, tap scrim/✕ to close. Respect `show_tooltips`.

### 6.6 Layer cards on mobile
- Full-width, comfortable padding, controls (coats/pigment) wrap to their own row, toggle top-right with a big hit area. Avoid cramped inline rows.

### 6.7 Quotes & admin tables on mobile
- Convert row tables to **stacked cards** (see §4). Pagination controls ≥44px.

### 6.8 Performance on mobile
- Lazy-load the PDF route (`@react-pdf/renderer` is ~1MB) and the admin bundle so the calculator loads fast on 4G.
- Memoise `calculate()`/`getLayersByStage`.
- Target a fast first paint; show the branded spinner immediately.

### 6.9 Mobile QA matrix
Test on: iPhone SE (375), iPhone 14/15 (390–393), Pixel (412), iPad portrait (768) and landscape (1024). Check: sticky bar + safe area, no input zoom, tap targets, bottom-sheet tooltips, nav drawer, no horizontal scroll, the two→one column switch.

---

## 7. Accessibility
- Contrast: `text-stone (#6F6B64)` on bone passes AA for body; don't go lighter than `ash` for anything meaningful. Orange **text** uses `molten-ink (#C2640E)`, not the lighter button orange. White-on-molten button: verify AA (the sampled hex must hit ≥4.5:1; if not, darken slightly for the button or use `molten-ink`).
- All icon-only buttons get `aria-label`; decorative icons `aria-hidden`.
- Focus-visible rings on every interactive element (`ring-2 ring-molten/40`).

---

## 8. Implementation phases
1. **Tokens + type + spinner/logo** — add `@theme`, fonts, `MagmaMark`/`MagmaSpinner`. *(Foundation.)*
2. **Global find-and-replace** (§5) across components; grep to zero. *(The look lands here.)*
3. **Mobile pass** — sticky bottom summary bar, touch-target audit, input sizing, tooltip bottom sheet, table→card. *(The priority.)*
4. **Nav** — active states, mobile drawer / bottom tabs.
5. **Imagery** — finish-swatch thumbnails, optional header texture.
6. **Phase 2 (later)** — basalt dark mode.

## 9. Acceptance criteria
- [ ] One brand orange (sampled from logo) used only for: logo, primary CTA, total accent, active-nav tint. `grep` for `blue-/orange-/gray-/#EA580C` in components = 0.
- [ ] Selected states are basalt; toggles sage; backgrounds warm neutrals.
- [ ] `MagmaSpinner` replaces all generic spinners.
- [ ] Sticky bottom summary bar on <lg with safe-area padding; total always visible while configuring.
- [ ] All interactive targets ≥44×44px on mobile; inputs ≥16px (no iOS zoom).
- [ ] Tooltips are bottom sheets on mobile.
- [ ] Quotes/admin tables render as stacked cards on mobile; no horizontal scroll anywhere.
- [ ] `npm run build` green; Lighthouse mobile pass (perf + a11y) sane.

## 10. Open items for Jason
1. **Drop `public/magma-logo.svg`** → I sample the exact orange + finalise the ring SVG.
2. Confirm font choice (Inter / Geist / other).
3. Bottom tab bar for installers on mobile — yes/no?
4. Finish photography/thumbnails — do you have material images for the colour picker?
