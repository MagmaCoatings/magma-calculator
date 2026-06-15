# Magma Calculator — Stage Review & Action List

_Verified against local working copy + live app on 15 Jun 2026._

## ✅ Fixed & verified in this bundle
- Desktop grid two-column (`lg:grid-cols-[1fr_340px]`) — results panel on the right.
- Sealer counted once (explicit block removed; subtotal dropped by one sealer).
- "Natural" colour no longer charges pigment (covers custom colours too).
- Auth race fixed — `getSession` awaits `fetchProfile` before clearing `loading`.
- Suspended users blocked in both `ProtectedRoute` and `AdminRoute`.
- Profiles RLS hardened + RLS added for `settings`, `custom_colours`, `colours` (SQL written).

## 🔴 Must do now (before trusting it)
1. **Run the SQL in Supabase** — execute `sql/fix_rls.sql` (and `complete_update.sql` / `settings_schema.sql` if not already applied). The fixes are files only; they do nothing until run.
2. **Verify the RLS actually blocks escalation** — as a non-admin user, attempt `update profiles set role='admin' where id=auth.uid();` → it must be **rejected**.
3. **Harden `is_admin()`** — add `SET search_path = public` to the function definition (SECURITY DEFINER best practice).
4. **Commit your work** — changes are still local/uncommitted; commit + push so GitHub matches.

## 🟠 Small leftovers from this bundle
5. **Remove the duplicate sealer UI** — the old standalone "Sealer" Matt/Satin section still renders below the new "Sealers" layer card. Keep one.
6. **Guard the loading spinner** — app now blocks on `fetchProfile`; add a timeout/fallback so a slow/failed profile fetch doesn't leave users stuck on an infinite spinner.

## ⬜ Still open (not in this bundle)
7. **Wire "Save Quote"** — button has no `onClick`; `SaveQuoteModal` is built but never rendered.
8. **Connect Settings to the calculator** — calculator still hardcodes floor area / wastage / VAT / pigment price and never reads the `settings` table.
9. **Delete dead files** — `Calculator-db.tsx`, `lib/calculations.ts`, `SystemsPage.backup.tsx`, `pages/admin/old/*`, and the stray `src/{components` folder.
10. **Calculator colour consistency** — admin is orange; calculator selection states are still blue.

## Definition of done for this stage
- [ ] `fix_rls.sql` run in Supabase and escalation test fails as expected
- [ ] `is_admin()` has `SET search_path`
- [ ] Duplicate sealer UI removed
- [ ] Loading spinner has a timeout fallback
- [ ] Work committed & pushed
