-- ============================================
-- CLEAN UP DUPLICATE system_products rows
-- Run in Supabase SQL Editor. Safe + idempotent.
--
-- Symptom: a product (e.g. Quartz 0.4-0.8mm) appears multiple times in the
-- same system in the same role, which over-counts it in quotes and caused a
-- React "duplicate key" warning. This removes exact-duplicate rows, keeping one.
--
-- "Exact duplicate" = same system + product + stage + option_group + depends_on.
-- Rows that genuinely differ (e.g. the two intended Quartz scatters in Build
-- Your Own: option_group scatter_dpm vs scatter_bondprime) are NOT touched.
-- ============================================

-- 1) DIAGNOSTIC (read-only) — see the duplicates first.
SELECT s.name AS system, p.name AS product, st.name AS stage,
       sp.option_group, sp.depends_on_product_id,
       count(*) AS copies,
       array_agg(sp.id ORDER BY sp.created_at) AS row_ids
FROM public.system_products sp
JOIN public.systems  s  ON s.id  = sp.system_id
JOIN public.products p  ON p.id  = sp.product_id
LEFT JOIN public.stages st ON st.id = sp.stage_id
GROUP BY s.name, p.name, st.name, sp.system_id, sp.product_id, sp.stage_id,
         sp.option_group, sp.depends_on_product_id
HAVING count(*) > 1
ORDER BY copies DESC, system, product;

-- 2) CLEANUP — keep the earliest row in each exact-duplicate group, delete the rest.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY system_id, product_id, stage_id,
                        COALESCE(option_group, ''),
                        COALESCE(depends_on_product_id::text, '')
           ORDER BY created_at, id
         ) AS rn
  FROM public.system_products
)
DELETE FROM public.system_products
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) VERIFY — re-run the diagnostic (step 1); it should return zero rows.
