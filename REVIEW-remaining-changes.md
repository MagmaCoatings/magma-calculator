# Magma Calculator — Remaining Changes (detailed spec)

Paste-ready instructions for the items still open after the last bundle.

---

## 1. 🔴 Apply the RLS SQL in Supabase (do this first)

The fix exists only as a file. In the Supabase dashboard → **SQL Editor → New query**, paste and run the contents of `sql/fix_rls.sql`.

Then **verify escalation is blocked** — log in as a non-admin (installer) and run, in the SQL editor *as that user's context* or via the app's client, the equivalent of:

```sql
update profiles set role = 'admin' where id = auth.uid();
```

Expected: **0 rows updated / policy violation**. If it succeeds, the policy didn't apply — re-check that RLS is enabled and the old permissive policy was dropped.

---

## 2. 🟠 Wire up "Save Quote"  →  `src/components/calculator/Calculator.tsx`

The button at ~line 897 does nothing and `SaveQuoteModal` is never rendered.

**a) Add the import (top of file):**
```tsx
import { SaveQuoteModal } from '@/components/SaveQuoteModal'
```

**b) Add modal state (near the other `useState`s, ~line 64):**
```tsx
const [showSaveModal, setShowSaveModal] = useState(false)
```

**c) Map calculator items to the modal's `ShoppingItem` shape.**
The modal expects `{ code, name, quantity, unitPrice, total }`, but `calculate()` returns `{ name, qty, units, unitSize, cost }`. Add this just after `const { items, subtotal } = calculate()` (~line 377):
```tsx
const quoteItems = items.map(it => ({
  code: '',                                  // no product code in current item shape
  name: it.name,
  quantity: it.units,
  unitPrice: it.units ? it.cost / it.units : 0,
  total: it.cost,
}))
```

**d) Give the button an onClick (~line 897). Disable it when empty:**
```tsx
<Button
  className="w-full mt-4"
  size="lg"
  disabled={items.length === 0}
  onClick={() => setShowSaveModal(true)}
>
  Save Quote
</Button>
```

**e) Render the modal (just before the final closing `</div>` of the component):**
```tsx
<SaveQuoteModal
  isOpen={showSaveModal}
  onClose={() => setShowSaveModal(false)}
  surfaceType={surface}
  floorArea={floorArea}
  wallArea={wallArea}
  items={quoteItems}
  subtotal={subtotal}
  vat={vat}
  total={total}
/>
```

**f) ⚠️ Check the DB columns match.** `SaveQuoteModal` inserts into `quotes` (`reference`, `project_name`, `created_by`, `status`) and `quote_items` (`product_code`, `product_name`, `quantity`, `unit_price`, `line_total`) and calls `rpc('generate_quote_reference')`. Confirm those columns/RPC exist in your live DB; if not, add a migration or adjust the insert.

---

## 3. 🟠 Connect Settings to the calculator  →  `src/components/calculator/Calculator.tsx`

Admins can edit defaults/VAT/pigment price, but the calculator ignores them.

**a) New hook — create `src/hooks/useSettings.ts`:**
```tsx
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface AppSettings {
  default_floor_area: number
  default_wall_area: number
  default_wastage_percent: number
  pigment_price: number
  vat_rate: number
}

const DEFAULTS: AppSettings = {
  default_floor_area: 20,
  default_wall_area: 10,
  default_wastage_percent: 10,
  pigment_price: 15,
  vat_rate: 0.2,
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('settings').select('key, value').then(({ data }) => {
      if (data) {
        const map = { ...DEFAULTS } as Record<string, number>
        data.forEach((r: { key: string; value: unknown }) => {
          const n = Number(r.value)
          if (!Number.isNaN(n)) map[r.key] = n
        })
        setSettings(map as AppSettings)
      }
      setLoading(false)
    })
  }, [])

  return { settings, loading }
}
```

**b) Use it in `Calculator.tsx`:**
```tsx
import { useSettings } from '@/hooks/useSettings'
// ...
const { settings, loading: settingsLoading } = useSettings()
```

**c) Seed the area/wastage defaults once settings load** (add an effect; only overwrite if the user hasn't typed yet — simplest is to seed on first load):
```tsx
useEffect(() => {
  setFloorArea(settings.default_floor_area)
  setWallArea(settings.default_wall_area)
  setWastagePercent(settings.default_wastage_percent)
}, [settings])
```

**d) Replace the hard-coded VAT (line 378) and pigment price (line 362):**
```tsx
const vat = subtotal * settings.vat_rate          // was: subtotal * 0.2
```
```tsx
const pigmentPrice = pigmentProduct?.price || settings.pigment_price   // was: || 15
```

**e)** Include `settingsLoading` in the top-level loading guard so the calculator doesn't flash default values:
```tsx
if (loading || coloursLoading || settingsLoading) { /* spinner */ }
```

---

## 4. 🟡 Delete dead / stray files

From the project root:
```bash
git rm src/components/calculator/Calculator-db.tsx
git rm src/lib/calculations.ts
git rm src/pages/admin/SystemsPage.backup.tsx
git rm -r src/pages/admin/old
rm -rf 'src/{components'        # stray folder from a shell brace-expansion typo
```
Then check nothing imports them (should be clean): `grep -rn "Calculator-db\|lib/calculations\|SystemsPage.backup\|admin/old" src`.

---

## 5. 🟡 Remove the now-unused `sealerType` state  →  `Calculator.tsx`

The standalone sealer UI was removed, so this is orphaned. Delete line ~74:
```tsx
const [sealerType, setSealerType] = useState<'matt' | 'satin'>('matt')   // delete
```
(If anything still references `sealerType`/`setSealerType`, remove those too — a build will flag them.)

---

## Verify after changes
```bash
npm run build      # should compile with no unused-var / type errors
npm run dev        # then in the app: Save Quote opens the modal & saves;
                   # changing a value in admin Settings changes the calculator defaults
```
