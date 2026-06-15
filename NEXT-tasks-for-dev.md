# Magma Calculator — remaining tasks

Context: React 18 + TS + Vite + Tailwind v4 + Supabase. Build is green and `profiles` RLS is fixed/applied. These are the outstanding items, in priority order. Each is independent. Don't change unrelated behaviour.

---

## A. Security / database

### A1 🟠 Fix the `quotes` RLS column mismatch
The live `quotes` table uses `created_by` (see `src/lib/database.types.ts`), but the policies in `magma_calculator_schema.sql` reference `user_id = auth.uid()`. So quote access control doesn't match the real column. The same applies to `quote_items` (scoped via the quote). Replace the quote/quote_item policies in Supabase with versions keyed on `created_by`:

```sql
-- QUOTES
DROP POLICY IF EXISTS "Users can view own quotes"   ON public.quotes;
DROP POLICY IF EXISTS "Users can create own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can view all quotes"  ON public.quotes;

CREATE POLICY "Users can view own quotes"   ON public.quotes FOR SELECT USING (created_by = auth.uid());
CREATE POLICY "Users can create own quotes" ON public.quotes FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own quotes" ON public.quotes FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Users can delete own quotes" ON public.quotes FOR DELETE USING (created_by = auth.uid());
CREATE POLICY "Admins can view all quotes"  ON public.quotes FOR SELECT USING (is_admin());

-- QUOTE ITEMS (scoped through the parent quote)
DROP POLICY IF EXISTS "Users can view own quote items"   ON public.quote_items;
DROP POLICY IF EXISTS "Users can manage own quote items" ON public.quote_items;

CREATE POLICY "Users can view own quote items" ON public.quote_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.created_by = auth.uid() OR is_admin())));
CREATE POLICY "Users can manage own quote items" ON public.quote_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.created_by = auth.uid()));
```
Then test: a non-admin can only read/update their own quotes; an admin can read all.

### A2 🟠 Add RLS to the systems tables
`systems`, `system_products`, `stages`, and `finish_presets` (+ `finish_preset_products`) hold pricing/config and have no RLS in any committed SQL. Enable RLS with authenticated-read / admin-write:

```sql
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['systems','system_products','stages','finish_presets','finish_preset_products']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "read %1$s" ON public.%1$I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin %1$s" ON public.%1$I;', t);
    EXECUTE format('CREATE POLICY "read %1$s"  ON public.%1$I FOR SELECT USING (auth.role() = ''authenticated'');', t);
    EXECUTE format('CREATE POLICY "admin %1$s" ON public.%1$I FOR ALL    USING (is_admin());', t);
  END LOOP;
END $$;
```
(Skip any table name that doesn't exist in your project.)

### A3 🟡 Stop audit-log spoofing
In `magma_calculator_schema.sql`, `login_logs` and `activity_log` use `INSERT WITH CHECK (TRUE)`, so any user can insert log rows for any `user_id`. Tighten:
```sql
DROP POLICY IF EXISTS "System can insert login logs"   ON public.login_logs;
CREATE POLICY "Users insert own login logs" ON public.login_logs FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert activity log" ON public.activity_log;
CREATE POLICY "Users insert own activity"   ON public.activity_log FOR INSERT WITH CHECK (user_id = auth.uid());
```

### A4 🟡 Consolidate schema into versioned migrations
`magma_calculator_schema.sql` is stale (missing `systems`, `system_products`, `stages`, `quote_history`, `settings`, `colours`, `custom_colours`, etc.). Move all schema + the RLS above into Supabase CLI migrations (`supabase/migrations/`) so the DB is reproducible and matches `src/lib/database.types.ts`.

---

## B. Functionality

### B1 🟠 Password reset has no landing page
`src/hooks/useAuth.tsx` (line ~161) sends users to `${origin}/reset-password`, but there's no such route, so the catch-all redirects to `/` and the reset can't be completed.
- Create `src/pages/ResetPasswordPage.tsx` with a form that calls `supabase.auth.updateUser({ password })` (the user arrives with a recovery session in the URL).
- Register it in `src/App.tsx` as a public route: `<Route path="/reset-password" element={<ResetPasswordPage />} />`.

### B2 🟡 Window-focus refetch wipes the user's configuration
In `src/components/calculator/Calculator.tsx` (~line 144) the `onFocus` effect calls `handleSystemChange(selectedSystemId)`, which re-initialises all `layerStates` to defaults — so switching tabs/apps and returning resets the user's selections. Either remove this effect, or refetch product data without resetting `layerStates` (merge new product metadata into existing state instead of replacing it).

---

## C. UX / polish

### C1 🟡 Calculator still uses blue selection states (brand is orange)
In `src/components/calculator/Calculator.tsx`, selection/active states use blue at lines 483, 510, 619, 687, 703, 714, 739. Replace with the brand orange to match the admin area, e.g. `bg-blue-600 text-white` → `bg-orange-600 text-white`, and `bg-blue-50 border-blue-500 text-blue-700` → `bg-orange-50 border-orange-500 text-orange-700`. (The "W" badge at 703 is intentionally a wall indicator — keep it distinct if you use F=orange/W=blue, but make the *selected-state* styling consistent.)

### C2 🟡 Number inputs can't be cleared
`Calculator.tsx` lines 639, 651, 662 use `parseFloat(e.target.value) || 1` (and `|| 0`), which forces an empty field back to 1/0 and blocks retyping. Use controlled string state and validate on blur, or allow empty during editing:
```tsx
onChange={e => {
  const v = e.target.value
  setFloorArea(v === '' ? '' : Number(v))   // store '' while editing
}}
onBlur={() => { if (floorArea === '' || Number(floorArea) <= 0) setFloorArea(1) }}
```
(Adjust types so the field can hold an empty string transiently.)

### C3 ⚪ Move IP/geo lookups off the client
`src/lib/supabase.ts` fetches `api.ipify.org` and `ipapi.co` from the browser on every login (privacy + reliability + spoofable). Move this into a Supabase Edge Function / server route that records IP and geo server-side.

### C4 ⚪ Surface query errors to the user
Several Supabase calls ignore `error` and render nothing on failure (e.g. the calculator shows a blank area if `systems` fails/loads empty). Add visible empty/error states ("Couldn't load systems — retry").

---

## D. Engineering health

### D1 ⚪ Add a React error boundary + minimal CI
Wrap the app in an error boundary so a render error doesn't white-screen. Add a CI check (GitHub Actions) running `npm ci && npm run build` on PRs — this would have caught the broken `tsc` build earlier.

### D2 ⚪ Loose ends
- `activity_log` + `log_activity()` exist but are never called from the client — wire them up or remove.
- `product_price_history.changed_by` is never populated on price edits — set it from `auth.uid()`.
- Admin lists (quotes, login logs) have no pagination — add range-based paging before the tables grow.

---

### Suggested order
A1 → A2 → A3 (security), then B1 → B2 (functionality), then C1 → C2 (quick UX wins), then C3/C4/D as time allows. Keep `npx tsc -b` green after each change.
