# Design fix — unify selection states (Calculator.tsx)

The palette tokens are correctly in place (`bg-limestone`, `bg-bone`, `bg-basalt`, `bg-sage`, `border-line`, `text-stone`, `border-molten`, etc.). The problem is **three conflicting "selected" styles**. This task makes selection consistent. **Do not change behaviour or logic — class strings only.**

All edits are in `src/components/calculator/Calculator.tsx`. Line numbers are approximate — match on the exact current string (each is unique). After editing, run the verification greps at the bottom.

---

## The canonical rule (apply exactly)

**Two tiers of "selected":**
- **Tier 1 — primary segmented controls** (surface type, family, build type): selected = `bg-basalt text-bone` (no shadow). Unselected = `bg-bone border border-line text-ink hover:border-stone`.
- **Tier 2 — in-card option chips** (product choice inside a layer, and the Coats number buttons): selected = `bg-bone border-2 border-basalt text-basalt font-medium`. Unselected = `bg-bone border border-line text-ink hover:border-stone`.

**Toggles** (include / pigment / tooltips): on = `bg-sage`, off = `bg-ash`. (Already correct — leave.)

**Orange (`molten`) is allowed in ONLY four places:** the logo, primary CTA buttons (Save quote / New quote), the total underline (`border-molten`), and active nav (`bg-molten-tint` + `text-molten`/`text-molten-ink`). It must not appear on any selection state.

---

## Edits

### 1. Layer card fill — currently blends into the page (the "muddy beige")
**Line ~638**
- Find: `bg-limestone border border-line-soft rounded-lg p-4`
- Replace: `bg-bone border border-line rounded-lg p-4`

### 2. Product choice chips — selected is orange → outlined basalt (Tier 2)
**Line ~682**
- Find: `'bg-molten text-white'`
- Replace: `'bg-bone border-2 border-basalt text-basalt font-medium'`
(Unselected on ~683 `'bg-bone border border-line text-ink hover:border-stone'` is correct — leave.)

### 3. Coats buttons — selected is orange → outlined basalt (Tier 2)
**Line ~713**
- Find: `'bg-molten text-white'`
- Replace: `'bg-bone border-2 border-basalt text-basalt font-medium'`
(Unselected ~714 `'bg-bone border border-line hover:border-stone'` — add `text-ink` so it reads: `'bg-bone border border-line text-ink hover:border-stone'`.)

### 4. Family pills — remove heavy shadow (Tier 1, already basalt)
**Line ~844**
- Find: `'bg-basalt text-bone shadow-md'`
- Replace: `'bg-basalt text-bone'`

### 5. Wall build-type (both mode) — amber-tint → solid basalt (Tier 1)
**Line ~968**
- Find: `'bg-molten-tint border-molten text-molten-ink border'`
- Replace: `'bg-basalt text-bone'`

### 6. Single-surface build-type — amber-tint → solid basalt (Tier 1)
**Line ~993**
- Find: `'bg-molten-tint border-molten text-molten-ink border'`
- Replace: `'bg-basalt text-bone'`
(Note: the floor build-type at ~941 is already `'bg-basalt text-bone'` — leave it. After edits 5 & 6, all three build-type selectors match.)

### 7. Colour swatch selected — drop heavy shadow
**Line ~1047**
- Find: `'border-basalt scale-110 shadow-lg'`
- Replace: `'border-basalt scale-110'`

### 8. Standardise ALL section labels to one class
The template (already used for "Surface type" L859 and "Area" L879) is:
`text-xs font-medium text-stone uppercase tracking-wide mb-3`

Apply it to every section label. Replace these:
- **L933** `text-xs text-ash mb-2` → `text-xs font-medium text-stone uppercase tracking-wide mb-2`
- **L960** `text-xs text-ash mb-2` → `text-xs font-medium text-stone uppercase tracking-wide mb-2`
- **L985** `text-sm text-stone mb-3` → `text-xs font-medium text-stone uppercase tracking-wide mb-3`
- **L1005** `text-sm text-stone mb-4` → `text-xs font-medium text-stone uppercase tracking-wide mb-4`
- **L1015** `text-sm text-stone mb-3` → `text-xs font-medium text-stone uppercase tracking-wide mb-3`
(Leave the family-name labels L1036/L1062 — already uppercase — and the `Materials` h2 L1124.)

### 9. Audit (do not blindly change) — line ~1067
`'bg-molten-tint text-molten-ink' : 'bg-line-soft text-stone hover:bg-line'` — identify what control this is.
- If it's an **active sub-tab/toggle** (e.g. sealer matt/satin, "use custom colour"): `bg-molten-tint`+`text-molten-ink` is acceptable as an *active* cue (same family as active-nav) — leave it.
- If it's a **product/option selection** like the others: change to the Tier 2 outlined-basalt style.

---

## Verification (run after edits)

```bash
cd src/components/calculator
# 1. No selection uses solid molten. bg-molten must ONLY be on the primary CTA button(s).
grep -n "bg-molten " Calculator.tsx        # every hit must be a Save/New-quote CTA — nothing else
# 2. The amber-tint selection style must be gone entirely:
grep -n "molten-tint border-molten" Calculator.tsx   # expect 0
# 3. Selection ternaries should only resolve to basalt:
grep -n "text-white'" Calculator.tsx       # expect 0 inside selection ternaries (CTA can keep text-white)
# 4. Build a clean type-check:
npx tsc -b   # must exit 0
```

## Acceptance criteria
- [ ] Every "selected" state is basalt — **solid** for surface/family/build-type, **outlined** (`border-2 border-basalt`) for product chips + coats.
- [ ] `bg-molten` appears only on: logo, Save/New-quote CTA, total underline (`border-molten`), active nav. Zero orange/amber on any selection.
- [ ] Layer cards are `bg-bone border-line` and read as distinct cards over the limestone page.
- [ ] All section labels share the one label class (uppercase tracked stone). No mixed casing/sizes.
- [ ] No `shadow-md`/`shadow-lg` on selected states (only the sticky summary card keeps `shadow-sm`).
- [ ] `npx tsc -b` green; no behaviour change.

## Reference
Match the "Target — one rule, two tiers" reference image: solid-basalt segmented controls; outlined-basalt in-card chips; orange only on logo / CTA / total underline / active nav; sage toggles.
