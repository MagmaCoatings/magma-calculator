# Magma Calculator — Functional Plan

A staged, prioritised list to work through. Status as of the restore from `2be2ab2`.
Each item has: **why**, rough **effort** (S/M/L), and **who** (me = in this tool, you = on your machine/Supabase).

---

## ✅ Done (verify, then tick off)

- **Brand orange sampled from logo** (`#F0851E`) — locked in `index.css`.
- **C3 — IP/geo lookup moved to Edge Function** — kept through the restore.
- **Build Your Own builder** — option groups, conditionals, two Quartz scatter positions, DPM over-mesh toggle.
- **Coverage & coats → product defaults + per-system override** — code complete (needs migration run to activate).
- **Stage reorder in admin**, **duplicate React key fix**, **+VAT mobile display**.

---

## Stage 1 — Activate & verify (do first: low risk, confirms health)

1. **Run pending SQL migrations** — *you, S.* `product_coverage_defaults.sql` then `byo_quartz_scatters.sql` in Supabase. Activates coverage inheritance + the two scatter positions.
2. **Verify coverage inheritance end-to-end** — *me, S.* Edit a product's coverage → confirm it flows into a system and Build Your Own; set an override → confirm it wins.
3. **Re-check login logging after restore** — *me, S.* The restore kept the Edge-Function `useAuth.tsx`; confirm logins + activity still record (the earlier silent-failure fix may need re-applying).
4. **🐛 Re-verify History button on mobile** — *me, S.* Confirm it's tappable on the restored build; fix if not.
5. **Data cleanup: duplicate Quartz** — *me + you, S.* One regular system lists the same product (`50d20f8d…`) in two stages. Identify which system and remove the stray row so it can't double-count.

## Stage 2 — Back-end hygiene (after Stage 1, schema is then final)

6. **A4 — Consolidate SQL migrations** — *me, M.* Merge the many one-off files in `/sql` into one ordered, idempotent migration (schema → coverage defaults → BYO system → scatters → RLS). Lets the DB be rebuilt cleanly.
7. **`supabase gen types typescript`** — *you + me, M.* Generate real DB types and replace `createClient<any>` in `supabase.ts`. Do this *after* the schema is final so types are accurate.
8. **Seed `finish_presets` for all 4 systems** — *me, M.* Populate default presets so the preset picker is useful in every system.

## Stage 3 — Mobile / UX polish

9. **InfoTip → bottom sheet on mobile** — *me, M.* Tooltips open as a bottom sheet on small screens instead of a cramped popover.
10. **Test v43 on real devices** — *you, M.* iPhone + Android: tap targets, safe-area, the +VAT bar, History button.

## Stage 4 — Quality / performance

11. **Code-split the bundle** — *me, M.* JS is one ~2.1 MB chunk (662 KB gzip). Lazy-load admin + the PDF library via dynamic `import()` for faster first load.
12. **Add ESLint** — *me, S.* No linter is configured; add a config + `lint` script to catch issues earlier.

## Stage 5 — Deployment & environments

Two targets: **Vercel for staging/testing** (set up early), **your own hosting for production** (later).

13. **Set up Vercel staging** — *you + me, M.* Gives a live URL to test on and share.
    - *me:* confirm build config (`vite build`, output `dist`, SPA rewrite in `vercel.json` ✓), list required env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), write the connect steps.
    - *you:* connect the GitHub repo in Vercel, paste the Supabase env vars, trigger the first deploy. Every push then auto-deploys a preview.
    - **Use this staging URL for item 10 (real-device testing).**
14. **Production deploy to your own hosting** — *you + me, L.* Once Stages 1–4 are green.
    - *me:* produce a production build + a deployment guide (static `dist/` → nginx/Apache/static host, with SPA fallback and the Supabase env vars baked at build time), and an `nginx.conf` example.
    - *you:* provision the server/host and run the deploy.
    - Decision to make: keep Vercel as production, or self-host fully — we can do either.

## Feature ideas (backlog)

- **Consumables (sanding pads, diamond discs)** — add a "Consumables" product category; give each a coverage rate (m² per disc/pad) and surface them as optional toggle items in a "Prep / Consumables" stage so quantity auto-calculates from the job area. Reuses the existing coverage calc + optional-toggle UI + admin — no new infrastructure. One-off items can use the quote's existing "Add Product".

## Parked

- **Terrazzo colour system** — revisit later.

---

### Suggested order
Stage 1 (1→5) → **Vercel staging (13) early, so everything after is testable on a real URL** → Stage 2 (6→8) → Stage 3 (9→10, test on the staging URL) → Stage 4 (11→12) → production deploy (14).
Items 1, 3, 4 are quick wins we can knock out immediately.
