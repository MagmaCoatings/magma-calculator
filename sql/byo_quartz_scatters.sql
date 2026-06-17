-- ============================================
-- BUILD YOUR OWN — Quartz scatter over BOTH the DPM epoxy and BondPrime
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Supersedes byo_quartz_after_dpm.sql (run this one instead).
--
-- Quartz can be broadcast onto the DPM epoxy OR onto BondPrime, so we offer
-- it as TWO independent optional toggles, each appearing right after its trigger:
--
--   DPM & Primers:  DPM Epoxy  →  Quartz (over DPM)  →  Liquid Membrane → Primer 200
--   Base Coats:     BondPrime  →  Quartz (over BondPrime)
--
-- Each only shows when its trigger is selected, and each is optional
-- (installers using their own sand just leave it off).
-- ============================================

-- 1) Make room in the DPM & Primers stage so the "over DPM" scatter sits
--    directly after the DPM epoxy primer.
WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
anchor AS (
  SELECT sp.stage_id, MIN(sp.display_order) AS ord
  FROM public.system_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo) AND p.code IN ('dpm_std', 'dpm_fast')
  GROUP BY sp.stage_id
)
UPDATE public.system_products sp
SET display_order = sp.display_order + 10
FROM anchor, public.products p
WHERE sp.system_id = (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1)
  AND sp.stage_id = anchor.stage_id
  AND sp.product_id = p.id
  AND p.code NOT IN ('dpm_std', 'dpm_fast', 'quartz')
  AND sp.display_order > anchor.ord;

-- 2) The EXISTING Quartz row becomes the "over DPM" scatter: move it into the
--    DPM & Primers stage right after the epoxy, depending on the DPM epoxy only.
WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
anchor AS (
  SELECT sp.stage_id, MIN(sp.display_order) AS ord
  FROM public.system_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo) AND p.code IN ('dpm_std', 'dpm_fast')
  GROUP BY sp.stage_id
),
dpm_ids AS (
  SELECT array_agg(sp.id) AS ids
  FROM public.system_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo) AND p.code IN ('dpm_std', 'dpm_fast')
)
UPDATE public.system_products q
SET stage_id = (SELECT stage_id FROM anchor),
    display_order = (SELECT ord FROM anchor) + 1,
    option_group = 'scatter_dpm',
    depends_on_product_ids = (SELECT ids FROM dpm_ids),
    depends_on_product_id = NULL,
    is_optional = true,
    coverage_note = 'Scatter over DPM epoxy · 25kg bag ≈ 6 m²'
WHERE q.system_id = (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1)
  AND q.product_id = (SELECT id FROM public.products WHERE code = 'quartz')
  AND (q.option_group IS NULL OR q.option_group = 'scatter_dpm');

-- 3) Add a SECOND Quartz row as the "over BondPrime" scatter: sits at the end
--    of the Base Coats stage (right after the BondPrime card), depending on BondPrime.
WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
bp AS (
  SELECT sp.id AS sp_id, sp.stage_id
  FROM public.system_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo) AND p.code = 'bondprime'
  LIMIT 1
),
maxord AS (
  SELECT COALESCE(MAX(sp.display_order), 0) + 1 AS ord
  FROM public.system_products sp, bp
  WHERE sp.system_id = (SELECT id FROM byo) AND sp.stage_id = bp.stage_id
)
INSERT INTO public.system_products (
  system_id, product_id, stage_id, coverage_sqm,
  default_coats, min_coats, max_coats,
  has_pigment, pigment_default_on, is_optional, is_default_option,
  option_group, coverage_note, display_order, depends_on_product_id, shared_across_surfaces
)
SELECT (SELECT id FROM byo),
       (SELECT id FROM public.products WHERE code = 'quartz'),
       (SELECT stage_id FROM bp),
       6, 1, 1, 1,
       false, false, true, false,
       'scatter_bondprime',
       'Scatter over BondPrime · 25kg bag ≈ 6 m²',
       (SELECT ord FROM maxord),
       (SELECT sp_id FROM bp),
       false
WHERE EXISTS (SELECT 1 FROM bp)
  AND NOT EXISTS (
    SELECT 1 FROM public.system_products x
    WHERE x.system_id = (SELECT id FROM byo)
      AND x.product_id = (SELECT id FROM public.products WHERE code = 'quartz')
      AND x.option_group = 'scatter_bondprime'
  );

-- Check the result:
-- SELECT st.name AS stage, p.name AS product, sp.option_group, sp.display_order
-- FROM system_products sp
-- JOIN systems s  ON s.id = sp.system_id AND s.family = 'Build Your Own'
-- JOIN stages  st ON st.id = sp.stage_id
-- JOIN products p ON p.id = sp.product_id
-- WHERE p.code = 'quartz'
-- ORDER BY st.display_order, sp.display_order;
