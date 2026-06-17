-- ============================================
-- PRODUCT-LEVEL COVERAGE & COATS DEFAULTS (with per-system override)
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- Moves coverage (m²/pack), coats and coverage note onto the PRODUCT as a
-- default. Every system inherits it automatically. A system_products row only
-- keeps a value when it's a genuine exception (NULL = inherit the product).
--
-- The calculator resolves: system_product value  ??  product default.
-- DPM epoxy carries BOTH rates: standard (coverage_sqm) and over-mesh.
-- ============================================

-- 1) Schema -----------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS coverage_sqm           numeric,
  ADD COLUMN IF NOT EXISTS coverage_sqm_over_mesh numeric,
  ADD COLUMN IF NOT EXISTS default_coats          integer,
  ADD COLUMN IF NOT EXISTS min_coats              integer,
  ADD COLUMN IF NOT EXISTS max_coats              integer,
  ADD COLUMN IF NOT EXISTS coverage_note          text;

ALTER TABLE public.system_products
  ADD COLUMN IF NOT EXISTS coverage_sqm_over_mesh numeric,
  ADD COLUMN IF NOT EXISTS coverage_sqm_per_pack  numeric;  -- legacy, kept so cleanup below is safe

-- Allow system_products values to be NULL (= inherit from product)
ALTER TABLE public.system_products ALTER COLUMN coverage_sqm   DROP NOT NULL;
ALTER TABLE public.system_products ALTER COLUMN default_coats  DROP NOT NULL;
ALTER TABLE public.system_products ALTER COLUMN min_coats      DROP NOT NULL;
ALTER TABLE public.system_products ALTER COLUMN max_coats      DROP NOT NULL;

-- 2) Backfill product defaults from the most common value across systems -----
-- Coverage (m²/pack)
WITH ranked AS (
  SELECT product_id, coverage_sqm,
         ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY COUNT(*) DESC, coverage_sqm) AS rn
  FROM public.system_products
  WHERE coverage_sqm IS NOT NULL AND coverage_sqm > 0
  GROUP BY product_id, coverage_sqm
)
UPDATE public.products p
SET coverage_sqm = r.coverage_sqm
FROM ranked r
WHERE r.product_id = p.id AND r.rn = 1 AND p.coverage_sqm IS NULL;

-- Default coats
WITH ranked AS (
  SELECT product_id, default_coats,
         ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY COUNT(*) DESC, default_coats) AS rn
  FROM public.system_products WHERE default_coats IS NOT NULL
  GROUP BY product_id, default_coats
)
UPDATE public.products p SET default_coats = r.default_coats
FROM ranked r WHERE r.product_id = p.id AND r.rn = 1 AND p.default_coats IS NULL;

-- Min coats
WITH ranked AS (
  SELECT product_id, min_coats,
         ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY COUNT(*) DESC, min_coats) AS rn
  FROM public.system_products WHERE min_coats IS NOT NULL
  GROUP BY product_id, min_coats
)
UPDATE public.products p SET min_coats = r.min_coats
FROM ranked r WHERE r.product_id = p.id AND r.rn = 1 AND p.min_coats IS NULL;

-- Max coats
WITH ranked AS (
  SELECT product_id, max_coats,
         ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY COUNT(*) DESC, max_coats) AS rn
  FROM public.system_products WHERE max_coats IS NOT NULL
  GROUP BY product_id, max_coats
)
UPDATE public.products p SET max_coats = r.max_coats
FROM ranked r WHERE r.product_id = p.id AND r.rn = 1 AND p.max_coats IS NULL;

-- Coverage note (first non-empty seen)
WITH ranked AS (
  SELECT product_id, coverage_note,
         ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY COUNT(*) DESC) AS rn
  FROM public.system_products WHERE coverage_note IS NOT NULL AND coverage_note <> ''
  GROUP BY product_id, coverage_note
)
UPDATE public.products p SET coverage_note = r.coverage_note
FROM ranked r WHERE r.product_id = p.id AND r.rn = 1 AND p.coverage_note IS NULL;

-- Sensible fallbacks for coats where nothing was found
UPDATE public.products SET default_coats = 1 WHERE default_coats IS NULL;
UPDATE public.products SET min_coats     = 1 WHERE min_coats IS NULL;
UPDATE public.products SET max_coats     = COALESCE(default_coats, 1) WHERE max_coats IS NULL;

-- 3) DPM epoxy: explicit dual rate (standard + over-mesh) --------------------
UPDATE public.products
SET coverage_sqm = 20,             -- standard 0.25 kg/m²
    coverage_sqm_over_mesh = 6.67, -- over mesh 0.75 kg/m²
    coverage_note = 'Standard 0.25 kg/m² (≈20 m²/pack) · Over mesh 0.75 kg/m² (≈6.67 m²/pack)'
WHERE code IN ('dpm_std', 'dpm_fast');

-- 4) Null out system overrides that match the product default (= inherit) ----
UPDATE public.system_products sp SET coverage_sqm = NULL
FROM public.products p
WHERE sp.product_id = p.id AND sp.coverage_sqm IS NOT NULL
  AND p.coverage_sqm IS NOT NULL AND sp.coverage_sqm = p.coverage_sqm;

UPDATE public.system_products sp SET default_coats = NULL
FROM public.products p
WHERE sp.product_id = p.id AND sp.default_coats IS NOT NULL
  AND p.default_coats IS NOT NULL AND sp.default_coats = p.default_coats;

UPDATE public.system_products sp SET min_coats = NULL
FROM public.products p
WHERE sp.product_id = p.id AND sp.min_coats IS NOT NULL
  AND p.min_coats IS NOT NULL AND sp.min_coats = p.min_coats;

UPDATE public.system_products sp SET max_coats = NULL
FROM public.products p
WHERE sp.product_id = p.id AND sp.max_coats IS NOT NULL
  AND p.max_coats IS NOT NULL AND sp.max_coats = p.max_coats;

UPDATE public.system_products sp SET coverage_note = NULL
FROM public.products p
WHERE sp.product_id = p.id AND sp.coverage_note IS NOT NULL
  AND p.coverage_note IS NOT NULL AND sp.coverage_note = p.coverage_note;

-- 5) Build Your Own DPM should inherit BOTH product rates (standard + over-mesh),
--    so the over-mesh / standard toggle is driven by the product, not a per-system value.
UPDATE public.system_products sp
SET coverage_sqm = NULL, coverage_sqm_over_mesh = NULL, coverage_sqm_per_pack = NULL
FROM public.systems s, public.products p
WHERE sp.system_id = s.id AND s.family = 'Build Your Own'
  AND sp.product_id = p.id AND p.code IN ('dpm_std', 'dpm_fast');

-- Done. Edit a product's coverage/coats once on the Products page; every system
-- inherits it. Override per system only where it genuinely differs.
