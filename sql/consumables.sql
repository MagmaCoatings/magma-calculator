-- ============================================
-- CONSUMABLES — universal, admin-managed physical extras (discs, pads…)
-- Run in Supabase SQL Editor. Safe + idempotent.
--
-- Consumables are products flagged is_consumable = true. Unlike microcement /
-- resins they are NOT measured by coverage — they are physical stock bought by
-- the unit (each), with a manual quantity in the calculator.
--
-- They support:
--   * consumable_group     — family heading (e.g. 'STR Discs 430mm (silicon carbide)')
--                            so grit variants group together in the calculator.
--   * consumable_min_order — minimum order qty across the whole group (mix & match
--                            any grits to reach it). NULL = no minimum.
-- Manage them in Admin → Products (tick "Consumable").
-- ============================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_consumable        boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS consumable_group     text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS consumable_min_order integer;
