-- ============================================
-- FIX: duplicate Quartz in regular systems
-- Run in Supabase SQL Editor. Safe + idempotent.
--
-- Some regular systems have TWO Quartz rows: the intended conditional one
-- (depends on a base coat / BondPrime) PLUS a leftover unconditional one
-- (no dependency, usually in the "Keying / Scatter" stage). Because both use
-- the same product with no option_group, they collapse to a single toggle in
-- the calculator and only one is ever costed — so toggling the other adds nothing.
--
-- This removes the leftover UNCONDITIONAL Quartz row only where a CONDITIONAL
-- Quartz already exists in the same system, leaving exactly one working Quartz.
-- Build Your Own is left untouched (its two scatters use distinct option groups).
-- ============================================

-- Preview what will be removed (optional — run on its own first):
-- SELECT s.name AS system, st.name AS stage, sp.id
-- FROM system_products sp
-- JOIN systems s   ON s.id = sp.system_id AND COALESCE(s.family,'') <> 'Build Your Own'
-- JOIN products p  ON p.id = sp.product_id AND p.code = 'quartz'
-- LEFT JOIN stages st ON st.id = sp.stage_id
-- WHERE sp.depends_on_product_id IS NULL
--   AND (sp.depends_on_product_ids IS NULL OR array_length(sp.depends_on_product_ids,1) IS NULL)
--   AND EXISTS (SELECT 1 FROM system_products q2 WHERE q2.system_id = sp.system_id
--               AND q2.product_id = sp.product_id AND q2.id <> sp.id
--               AND (q2.depends_on_product_id IS NOT NULL OR q2.depends_on_product_ids IS NOT NULL));

DELETE FROM public.system_products sp
USING public.systems s, public.products p
WHERE sp.system_id = s.id
  AND COALESCE(s.family, '') <> 'Build Your Own'
  AND sp.product_id = p.id AND p.code = 'quartz'
  AND sp.depends_on_product_id IS NULL
  AND (sp.depends_on_product_ids IS NULL OR array_length(sp.depends_on_product_ids, 1) IS NULL)
  AND EXISTS (
    SELECT 1 FROM public.system_products q2
    WHERE q2.system_id = sp.system_id
      AND q2.product_id = sp.product_id
      AND q2.id <> sp.id
      AND (q2.depends_on_product_id IS NOT NULL OR q2.depends_on_product_ids IS NOT NULL)
  );
