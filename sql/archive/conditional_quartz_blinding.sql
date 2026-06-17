-- ============================================
-- Add conditional Quartz blinding after BondPrime SC
-- Run in Supabase SQL Editor.
-- For every system that offers BondPrime SC, this adds a
-- "Quartz 0.4-0.8mm" blinding layer in the SAME stage, set to
-- depend on BondPrime — so it only appears (and is only charged)
-- when BondPrime SC is the selected base coat.
-- Safe to re-run: it skips systems that already have it.
-- ============================================

INSERT INTO public.system_products (
  system_id, product_id, stage_id, coverage_sqm,
  default_coats, min_coats, max_coats,
  has_pigment, pigment_default_on, is_optional, is_default_option,
  coverage_note, display_order, depends_on_product_id, shared_across_surfaces
)
SELECT
  bp.system_id,
  (SELECT id FROM public.products WHERE code = 'quartz'),  -- Quartz 0.4-0.8mm
  bp.stage_id,                                             -- same stage as BondPrime (Base Coats)
  6,                                                       -- 1 x 25kg bag covers 6 m²
  1, 1, 1,
  false, false,
  true,    -- is_optional  (shows a toggle)
  true,    -- is_default_option (on by default when BondPrime is selected)
  '25kg bag covers 6m² - blinding sand',
  bp.display_order + 1,                                    -- sits right after BondPrime
  bp.id,                                                   -- conditional on THIS BondPrime row being selected
  false
FROM public.system_products bp
JOIN public.products p ON p.id = bp.product_id AND p.code = 'bondprime'
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_products q
  WHERE q.system_id = bp.system_id
    AND q.depends_on_product_id = bp.id
    AND q.product_id = (SELECT id FROM public.products WHERE code = 'quartz')
);

-- Check what was added:
-- SELECT s.name AS system, st.name AS stage, sp.coverage_note, sp.depends_on_product_id
-- FROM system_products sp
-- JOIN systems s  ON s.id = sp.system_id
-- JOIN stages  st ON st.id = sp.stage_id
-- WHERE sp.product_id = (SELECT id FROM products WHERE code = 'quartz')
--   AND sp.depends_on_product_id IS NOT NULL;
