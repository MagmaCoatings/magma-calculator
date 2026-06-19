-- ============================================
-- CONSUMABLES — universal, admin-managed extras (sanding pads, diamond discs…)
-- Run in Supabase SQL Editor. Safe + idempotent.
--
-- Consumables are just products flagged is_consumable = true. They aren't tied
-- to any system; the calculator shows them as a universal "Consumables / Extras"
-- list the installer can add to a quote with a manual quantity.
-- Manage them in Admin → Products (tick "Consumable").
-- ============================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_consumable boolean DEFAULT false;

-- Example (optional) — uncomment to seed a couple:
-- INSERT INTO public.products (code, name, pack_size, pack_unit, price, is_consumable, is_active, display_order)
-- VALUES
--   ('disc_diamond', 'Diamond Grinding Disc', 1, 'disc', 35, true, true, 900),
--   ('pad_sanding',  'Sanding Pad',           1, 'pad',  6,  true, true, 901)
-- ON CONFLICT (code) DO NOTHING;
