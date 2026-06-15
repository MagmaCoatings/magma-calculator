# Task: make `npm run build` pass (TypeScript build is currently failing)

Context: Magma Calculator (React 18 + TS + Vite + Tailwind v4 + Supabase). `npm run dev` works, but `npm run build` (`tsc -b && vite build`) fails with 37 TypeScript errors. Recent work added `src/lib/database.types.ts` (a typed Supabase `Database`) and rewired `src/lib/supabase.ts`, but several things are incomplete/regressed. Fix all of the items below, then run `npx tsc -b` until it exits 0. Do not change runtime behaviour — these are type-level fixes only.

---

## 1. Regression: `src/lib/types.ts` no longer exports types that `useProducts.ts` needs
`src/lib/types.ts` was reduced to `export type { Profile, Database, Json } from './database.types'`, but `src/hooks/useProducts.ts` imports `Product`, `ColourSwatch`, `ColourFamily`, which are now undefined (3 errors).

Add these alias exports to `src/lib/types.ts`:
```ts
export type Product = Database['public']['Tables']['products']['Row']
export type ColourSwatch = Database['public']['Tables']['colours']['Row']
export type ColourFamily = { id: string; name: string; display_order: number }
```
Note: the current schema uses a single flat `colours` table (not `colour_families`/`colour_swatches`). If `useProducts.ts` / `useColours.tsx` reference fields that don't exist on the `colours` row, update those hooks to match the real `colours` columns.

## 2. `quote_history` table is missing from the `Database` type
`src/pages/QuoteDetailPage.tsx` calls `.from('quote_history')` (lines ~150 and ~173), but `quote_history` is not defined in `src/lib/database.types.ts`, so those queries resolve to `never` and cascade into ~15 errors.

Add a `quote_history` table to `Database['public']['Tables']` in `src/lib/database.types.ts`, e.g.:
```ts
quote_history: {
  Row: {
    id: string
    quote_id: string
    changed_by: string | null
    change_type: string
    notes: string | null
    created_at: string
  }
  Insert: Partial<Database['public']['Tables']['quote_history']['Row']>
  Update: Partial<Database['public']['Tables']['quote_history']['Row']>
}
```
Adjust the column names/types to match the actual `quote_history` table in Supabase.

## 3. Joined-alias columns in `QuoteDetailPage.tsx`
Some `select()` calls pull aliased fields from embedded joins (e.g. `creator_name`, `creator_email`, `changed_by_name`) that don't exist on the base Row types. Either:
- type the joined result explicitly (define an interface for the query shape and annotate the result), or
- cast the specific query results to that interface.
Do not use blanket `any`; type the shape that each query actually returns.

## 4. `.eq('id', id)` where `id` is `string | undefined`
`useParams()` returns `{ id?: string }`. In `QuoteDetailPage.tsx` (lines ~102, ~136, ~152) `id` is passed to `.eq('id', id)` and `.rpc()` and fails (`string | undefined` not assignable). Add an early guard at the top of the relevant functions/effect:
```ts
if (!id) return
```
(or narrow once and reuse).

## 5. `SaveQuoteModal.tsx` insert types
Verify the `quote_items` table Row in `database.types.ts` includes exactly the columns the insert uses: `quote_id`, `product_code`, `product_name`, `quantity`, `unit_price`, `line_total`, `display_order`. And confirm `quotes` Row includes `reference`, `project_name`, `created_by`, `status`. Add any missing columns to the Row types so the inserts type-check. Also ensure the `generate_quote_reference` RPC is declared (or cast its result) so it's not `never`.

## 6. Remove unused locals (strict `noUnusedLocals` / `noUnusedParameters`)
- `src/components/calculator/Calculator.tsx` line ~6: remove unused `Card` import.
- `src/components/calculator/Calculator.tsx` line ~246: remove unused `updateLayer` function (or use it).
- `src/components/layout/Header.tsx` line ~4: remove unused `User` import.
- `src/hooks/useAuth.tsx` line ~116: unused `event` param in `onAuthStateChange` callback — rename to `_event` or omit.

---

## Acceptance criteria
- `npx tsc -b` exits 0 (no errors).
- `npm run build` completes successfully.
- `npm run dev` still runs and the app behaves the same (calculator totals, Save Quote modal, admin pages unaffected).

## Separate, still-outstanding (NOT a build issue — do in Supabase, not code)
Run `sql/fix_rls.sql` in the Supabase SQL Editor, then verify a non-admin cannot run `update profiles set role='admin' where id=auth.uid();` (must be rejected).
