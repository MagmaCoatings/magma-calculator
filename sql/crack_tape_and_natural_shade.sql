-- Crack Bridging Tape + "natural shade" pigment rule (October 2026)
-- Run once in Supabase SQL Editor. Safe to re-run: it skips anything already added.

BEGIN;

-- New product settings (both optional, editable in Admin > Products)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS natural_colour text;  -- colour the product already is unpigmented
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS qty_per_job integer;  -- fixed packs per job, ignores area

-- Magma 500 Medium is naturally Nectar 1: no pigment for Medium when Nectar 1 is chosen
UPDATE public.products SET natural_colour = 'Nectar 1' WHERE code = 'magma_500';

-- The tape itself (1 roll of 100m per job), in the same category as Liquid Membrane
INSERT INTO public.products (code, name, description, pack_size, pack_unit, price, is_active, qty_per_job, category_id, display_order)
SELECT 'crack_tape',
       'Crack Bridging Tape / Tanking Roll (100m x 15cm)',
       'Fabric reinforcement tape used with Liquid Membrane in wet areas, at corners, joints and junctions. 1 roll (100m) per job.',
       1, 'roll', 78.50, true, 1, lm.category_id, lm.display_order
FROM public.products lm
WHERE lm.code = 'liquid_membrane_5'
  AND NOT EXISTS (SELECT 1 FROM public.products WHERE code = 'crack_tape');

-- Add it to every system that contains Liquid Membrane (Wall Belt & Braces, Build Your Own).
-- It only appears when Liquid Membrane is switched on, and is on by default.
INSERT INTO public.system_products (
  system_id, product_id, stage_id, is_optional, is_default_option, option_group,
  has_pigment, display_order, depends_on_product_id, shared_across_surfaces, applications, coverage_note)
SELECT lm.system_id, t.id, lm.stage_id, true, true, NULL,
       false, COALESCE(lm.display_order, 0) + 1, lm.id, true, lm.applications,
       '1 roll (100m) per job, used with Liquid Membrane'
FROM public.system_products lm
JOIN public.products m ON m.id = lm.product_id AND m.code = 'liquid_membrane_5'
CROSS JOIN public.products t
WHERE t.code = 'crack_tape'
  AND NOT EXISTS (SELECT 1 FROM public.system_products x WHERE x.system_id = lm.system_id AND x.product_id = t.id);

COMMIT;

-- Check: should list the tape in Wall Belt & Braces and Build Your Own
SELECT s.name AS system, p.name AS product, p.price, p.qty_per_job, d.name AS depends_on
FROM public.system_products sp
JOIN public.systems s ON s.id = sp.system_id
JOIN public.products p ON p.id = sp.product_id
LEFT JOIN public.system_products dsp ON dsp.id = sp.depends_on_product_id
LEFT JOIN public.products d ON d.id = dsp.product_id
WHERE p.code = 'crack_tape';
