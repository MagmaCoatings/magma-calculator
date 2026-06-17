-- ============================================
-- BUILD YOUR OWN — put Quartz scatter directly under the DPM epoxy primer
-- Run once in Supabase SQL Editor. Safe to re-run (order is preserved).
--
-- Desired order in the DPM & Primers stage:
--   DPM Epoxy Primer  →  Quartz 0.4-0.8mm  →  Liquid Membrane  →  Primer 200
-- (then the Fibreglass Mesh stage follows as before)
--
-- Quartz stays conditional (only shows when BondPrime or a DPM epoxy is
-- selected) and optional. This just moves WHERE it appears.
-- ============================================

-- 1) Make room: push the other DPM/primer products down so Quartz can sit
--    immediately after the DPM epoxy.
WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
anchor AS (
  SELECT sp.stage_id, MIN(sp.display_order) AS ord
  FROM public.system_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo)
    AND p.code IN ('dpm_std', 'dpm_fast')
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

-- 2) Move Quartz into the DPM & Primers stage, directly after the DPM epoxy.
WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
anchor AS (
  SELECT sp.stage_id, MIN(sp.display_order) AS ord
  FROM public.system_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo)
    AND p.code IN ('dpm_std', 'dpm_fast')
  GROUP BY sp.stage_id
)
UPDATE public.system_products q
SET stage_id = (SELECT stage_id FROM anchor),
    display_order = (SELECT ord FROM anchor) + 1
WHERE q.system_id = (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1)
  AND q.product_id = (SELECT id FROM public.products WHERE code = 'quartz');

-- Check the resulting order:
-- SELECT st.name AS stage, p.name AS product, sp.display_order
-- FROM system_products sp
-- JOIN systems s  ON s.id = sp.system_id AND s.family = 'Build Your Own'
-- JOIN stages  st ON st.id = sp.stage_id
-- JOIN products p ON p.id = sp.product_id
-- ORDER BY st.display_order, sp.display_order;
