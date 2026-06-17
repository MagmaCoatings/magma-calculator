-- ============================================
-- BUILD YOUR OWN — editable backend system
-- Run once in Supabase SQL Editor.
-- Creates a "Build Your Own" system you can amend in the Systems admin.
-- It copies every distinct product (with the coverage/coats/option-group
-- already configured elsewhere), makes them all optional/toggleable, and
-- sets the Quartz scatter to appear after BondPrime OR a DPM epoxy primer.
-- Safe to re-run.
-- ============================================

-- 1) Schema: allow a product to depend on ANY of several triggers (e.g. epoxy OR bondprime)
ALTER TABLE public.system_products
  ADD COLUMN IF NOT EXISTS depends_on_product_ids uuid[];

-- 2) Create the system (identified by family = 'Build Your Own')
INSERT INTO public.systems (name, description, surface_type, family, is_active, display_order)
SELECT 'Build Your Own', 'Pick and choose individual products', 'both', 'Build Your Own', true, 999
WHERE NOT EXISTS (SELECT 1 FROM public.systems WHERE family = 'Build Your Own');

-- 3) Copy every distinct product into it (inherit coverage/stage/coats/option-group), all optional.
--    Pigment is excluded (it's auto-calculated from pigmented layers).
WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
dp AS (
  SELECT DISTINCT ON (sp.product_id)
    sp.product_id, sp.stage_id, sp.coverage_sqm, sp.coverage_note,
    sp.has_pigment, sp.min_coats, sp.max_coats, sp.default_coats,
    sp.option_group, sp.display_order
  FROM public.system_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE p.is_active = true
    AND p.code <> 'pigment'
  ORDER BY sp.product_id, sp.display_order
)
INSERT INTO public.system_products (
  system_id, product_id, stage_id, coverage_sqm, coverage_note,
  has_pigment, min_coats, max_coats, default_coats,
  is_optional, is_default_option, option_group, display_order, shared_across_surfaces
)
SELECT byo.id, dp.product_id, dp.stage_id, dp.coverage_sqm, dp.coverage_note,
       dp.has_pigment, dp.min_coats, dp.max_coats, dp.default_coats,
       true, false, dp.option_group, dp.display_order, false
FROM dp CROSS JOIN byo
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_products x WHERE x.system_id = byo.id AND x.product_id = dp.product_id
);

-- 4) Quartz scatter: optional, appears only after BondPrime OR a DPM epoxy primer (within this system)
WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
triggers AS (
  SELECT array_agg(sp.id) AS ids
  FROM public.system_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo)
    AND p.code IN ('bondprime', 'dpm_std', 'dpm_fast')
)
UPDATE public.system_products q
SET depends_on_product_ids = (SELECT ids FROM triggers),
    is_optional = true
WHERE q.system_id = (SELECT id FROM byo)
  AND q.product_id = (SELECT id FROM public.products WHERE code = 'quartz');

-- Done. Edit everything (which products, order, option-groups, prices) in Admin → Systems → Build Your Own.
