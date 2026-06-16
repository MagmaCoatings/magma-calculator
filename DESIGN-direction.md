# Magma Calculator — Design direction & responsive review

## The honest read on the current look
It's clean and functional, but it reads as a **generic SaaS app**, not a premium material brand. Three reasons:
1. **Orange is doing too much.** `#EA580C` fills selected products, coats, the total, the Save button and active toggles all at once. When everything shouts, nothing feels considered — and bright safety-orange is the least "premium" way to use the brand colour.
2. **Default Tailwind styling.** Pure-grey background, hard `#fff` cards, system spacing — competent but anonymous. No typographic point of view.
3. **No material warmth.** Your product is tactile, mineral, architectural. The UI is cool and clinical — the opposite of how Kerakoll/Ideal Work present.

## What the premium competitors actually do
- **Kerakoll** — warm neutral canvas (cream/stone), big architectural photography, refined type, and almost no saturated colour in the UI itself. Colour comes from the *materials*, not the chrome. A calm dark-slate accent.
- **Ideal Work** — charcoal CTAs, a muted clay/blush secondary, lots of architectural imagery; restraint + photography = premium.
- **Forcrete** — busy e-commerce, mega-menus; useful as a *contrast* — this is the look to avoid.

The common thread: **warm neutrals + photography + restraint + one disciplined accent.**

## My recommendation: direction "Refined Mineral"
It's a blend of your options 1 and 2 — keep orange, but **demote it to a true accent** and rebuild the palette around sophisticated mineral neutrals that literally match the brand name (basalt, stone, ash, bone, with a *molten* accent). See the mockup above.

### Palette
| Role | Colour | Use |
|---|---|---|
| Basalt | `#211F1D` | Primary text, selected states, dark surfaces |
| Stone | `#6F6B64` | Secondary text/labels |
| Ash | `#D8D2C8` | Hairlines, disabled, dividers |
| Limestone | `#ECE8E1` | Page background (warm, not cold grey) |
| Bone | `#FBFAF7` | Cards (warm off-white, not stark `#fff`) |
| **Molten** | `#C2410C` | **Accent only** — primary CTA, the total figure's underline, key highlights. A deeper, more refined orange than `#EA580C`. |
| Sage | `#5F6B57` | "Included" toggles (calmer than bright green) |

The shift that does the heavy lifting: **selected states become Basalt (dark), not orange.** Orange then appears 2–3 times per screen max — Save button + the total. That alone makes it look 10× more expensive, and makes the Save button actually pop.

### Typography
- One refined sans for the UI — `Inter`, `General Sans`, or `Geist` (free, modern, premium). Bump line-height and letter-spacing slightly.
- Larger, lighter section labels (small, muted, generous tracking) instead of the current bold grey.
- The **total** is the hero number — large, Basalt, with a thin Molten underline.

### Spacing & surfaces
- More whitespace between cards (24px+), larger card radius (12–16px), **hairline borders** (`#E4DFD7`), and **no heavy shadows** — a single very soft shadow at most. Flat + warm + roomy = premium.

### The thing that will matter most: photography
The single biggest premium lever is **imagery**. A muted microcement texture or one architectural hero behind the login/header, and small **material swatch thumbnails** on the colour picker (real finishes, not just hex chips), will do more than any palette tweak. This is exactly what Kerakoll leans on.

---

## Responsive review (desktop / tablet / mobile)

### Desktop (≥1024px) — good bones, fixable polish
- The two-column layout (config + sticky summary) now works and is the right pattern. Keep the summary sticky.
- Issues: too much orange (above), tight vertical rhythm, generic cards. All cosmetic.

### Tablet (768–1024px) — the weak spot
- The summary panel only appears as a side column at `lg` (1024px). On an **iPad portrait (768px)** you currently drop to a single column with the materials/total pushed to the **bottom** — so the installer can't see the price while configuring. That's the worst case for your main user.
- Fix: introduce a **sticky bottom summary bar** below `lg` — a slim bar pinned to the viewport showing running **Total** + a "View materials" expand. Quoting on an iPad on site is probably your most common real-world use, so this matters.

### Mobile (≤640px)
- Single-column stack is right. Header already collapses labels to icons — good.
- Touch targets: the **colour swatches are ~32px** — bump to ≥44px for thumbs. Coat buttons and the info "ⓘ" icons likewise need ≥44px tap areas.
- Tooltips: use a **bottom sheet** on mobile rather than a floating popover (easier to read, easier to dismiss).
- The sticky bottom total bar (from tablet) applies here too — it's the single best mobile UX add.

---

## Your four questions, answered
1. **Keep orange & modernise?** Yes — but only by *demoting* orange to an accent and rebuilding around mineral neutrals. Modernised-but-still-orange-everywhere won't reach "premium."
2. **New colour scheme — what represents Magma?** Magma = molten rock → **basalt, stone, ash, bone + a molten accent.** It's premium *and* tells the brand story. (Recommended — see palette.)
3. **Dark mode?** Lovely fit for this brand (a "basalt" dark mode could look stunning) — but **Phase 2**. Get the light theme genuinely premium first; dark mode doubles the QA surface.
4. **Inspiration?** Lean hardest on **Kerakoll** (warm neutrals + photography + restraint) and **Ideal Work** (charcoal CTAs, architectural imagery). For the *app* craft specifically, Linear / Stripe Dashboard / Arc are the references for restrained, premium product UI.

---

## Suggested approach
1. **Palette + type pass** (low effort, huge impact): swap selected states to Basalt, demote orange to CTA+total, warm the neutrals, adopt one premium sans. Best done as Tailwind theme tokens so it's centralised.
2. **Sticky bottom summary bar** for tablet/mobile + bump touch targets.
3. **Imagery**: material textures + swatch thumbnails on the colour picker.
4. **Phase 2**: dark "basalt" mode.

If you like "Refined Mineral", I can turn step 1 into a concrete Tailwind theme (colour tokens + the class find-and-replace map) so your dev can apply it in one pass.
