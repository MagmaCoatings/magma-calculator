-- ============================================
-- FIX: duplicate Quartz in regular systems (robust)
-- Run in Supabase SQL Editor. Safe + idempotent.
--
-- Some regular systems have MORE THAN ONE Quartz row (e.g. an intended
-- conditional one that depends on BondPrime, plus a leftover one). Because they
-- share the same product with no option group, they collapse to a single toggle
-- and only one is ever costed — so the extra card does nothing.
--
-- This keeps exactly ONE Quartz per regular system (preferring a CONDITIONAL one
-- — i.e. one that depends on a base coat — so the BondPrime blinding behaviour is
-- retained) and removes the rest. Build Your Own is left untouched.
-- ============================================

-- Preview what will be removed (optional — run this SELECT on its own first):
-- WITH ranked AS (
--   SELECT sp.id, s.name AS system, st.name AS stage,
--          row_number() OVER (PARTITION BY sp.system_id
--            ORDER BY (sp.depends_on_product_id IS NOT NULL OR sp.depends_on_product_ids IS NOT NULL) DESC,
--                     sp.created_at, sp.id) AS rn
--   FROM system_products sp
--   JOIN systems s   ON s.id = sp.system_id AND COALESCE(s.family,'') <> 'Build Your Own'
--   JOIN products p  ON p.id = sp.product_id AND p.code = 'quartz'
--   LEFT JOIN stages st ON st.id = sp.stage_id
-- )
-- SELECT * FROM ranked WHERE rn > 1;   -- these rows will be deleted

WITH ranked AS (
  SELECT sp.id,
         row_number() OVER (
           PARTITION BY sp.system_id
           ORDER BY (sp.depends_on_product_id IS NOT NULL OR sp.depends_on_product_ids IS NOT NULL) DESC,
                    sp.created_at, sp.id
         ) AS rn
  FROM public.system_products sp
  JOIN public.systems  s ON s.id = sp.system_id AND COALESCE(s.family, '') <> 'Build Your Own'
  JOIN public.products p ON p.id = sp.product_id AND p.code = 'quartz'
)
DELETE FROM public.system_products
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Verify (should return one row per system, or zero extras):
-- SELECT s.name, count(*) FROM system_products sp
-- JOIN systems s ON s.id = sp.system_id AND COALESCE(s.family,'') <> 'Build Your Own'
-- JOIN products p ON p.id = sp.product_id AND p.code='quartz'
-- GROUP BY s.name HAVING count(*) > 1;
