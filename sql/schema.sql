-- ============================================================================
-- MAGMA CALCULATOR — CONSOLIDATED SCHEMA & SEED
-- One ordered, idempotent migration. Safe to run repeatedly.
--
-- Assumes the base tables created by the initial Supabase setup already exist
-- (profiles, products, systems, stages, system_products, colours, quotes,
--  quote_items, finish_presets, finish_preset_products, login_logs).
-- This file layers on every app customisation in dependency order and SUPERSEDES
-- these now-archived one-off files:
--   complete_update.sql, settings_schema.sql, activity_log.sql, fix_rls.sql,
--   rls_security_fixes.sql, build_your_own_system.sql, conditional_quartz_blinding.sql,
--   byo_dpm_over_mesh.sql, byo_quartz_after_dpm.sql, byo_quartz_scatters.sql,
--   product_coverage_defaults.sql, cleanup_duplicate_system_products.sql
-- ============================================================================


-- ============================================================================
-- 1) HELPER FUNCTION (used by RLS below; define first)
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- 2) APP TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_colours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hex text NOT NULL,
  brand text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_name text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id     ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at  ON activity_log(created_at DESC);


-- ============================================================================
-- 3) COLUMN ADDITIONS
-- ============================================================================
ALTER TABLE systems ADD COLUMN IF NOT EXISTS family     text DEFAULT 'Microcement';
ALTER TABLE systems ADD COLUMN IF NOT EXISTS build_type text DEFAULT 'standard';

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_name  text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_hex   text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_brand text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_id    uuid REFERENCES custom_colours(id);

-- custom_colours may pre-exist from an older version without these columns
-- (CREATE TABLE IF NOT EXISTS above won't add columns to an existing table)
ALTER TABLE custom_colours ADD COLUMN IF NOT EXISTS brand      text;
ALTER TABLE custom_colours ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE custom_colours ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Build Your Own + coverage model
ALTER TABLE system_products ADD COLUMN IF NOT EXISTS depends_on_product_ids uuid[];
ALTER TABLE system_products ADD COLUMN IF NOT EXISTS coverage_sqm_over_mesh numeric;
ALTER TABLE system_products ADD COLUMN IF NOT EXISTS coverage_sqm_per_pack  numeric; -- legacy, kept for safety

-- login_logs columns the app writes/reads (table originally lacked these)
ALTER TABLE public.login_logs
  ADD COLUMN IF NOT EXISTS email          text,
  ADD COLUMN IF NOT EXISTS success        boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS region         text,
  ADD COLUMN IF NOT EXISTS created_at      timestamptz DEFAULT now();

ALTER TABLE products ADD COLUMN IF NOT EXISTS coverage_sqm           numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS coverage_sqm_over_mesh numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_coats          integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_coats              integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_coats              integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS coverage_note          text;

-- Per-system values become optional overrides (NULL = inherit the product default)
ALTER TABLE system_products ALTER COLUMN coverage_sqm  DROP NOT NULL;
ALTER TABLE system_products ALTER COLUMN default_coats DROP NOT NULL;
ALTER TABLE system_products ALTER COLUMN min_coats     DROP NOT NULL;
ALTER TABLE system_products ALTER COLUMN max_coats     DROP NOT NULL;


-- ============================================================================
-- 4) REFERENCE DATA (non-destructive: only seeds when empty)
-- ============================================================================
INSERT INTO settings (key, value, description) VALUES
  ('default_floor_area',     '20',  'Default floor area in m²'),
  ('default_wall_area',      '10',  'Default wall area in m²'),
  ('default_wastage_percent','10',  'Default wastage percentage'),
  ('pigment_price',          '15',  'Price per pigment pot in GBP'),
  ('vat_rate',               '0.2', 'VAT rate (0.2 = 20%)')
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM colours) THEN
    INSERT INTO colours (name, hex_code, family, display_order) VALUES
      ('Natural (No Pigment)', '#F5F5F0', 'Natural', 0),
      ('Grey 1', '#E8E6E0', 'Grey', 1), ('Grey 2', '#DCDAD4', 'Grey', 2),
      ('Grey 3', '#C8C4BC', 'Grey', 3), ('Grey 4', '#A8A69E', 'Grey', 4),
      ('Grey 5', '#8A8880', 'Grey', 5), ('Grey 6', '#6E6C66', 'Grey', 6),
      ('Plume 1', '#E4DED8', 'Plume', 1), ('Plume 2', '#D4CCC4', 'Plume', 2),
      ('Plume 3', '#C4B8B0', 'Plume', 3), ('Plume 4', '#A8988C', 'Plume', 4),
      ('Plume 5', '#988478', 'Plume', 5),
      ('Earth 1', '#E8E2D4', 'Earth', 1), ('Earth 2', '#DCD4C4', 'Earth', 2),
      ('Earth 3', '#D0C8B4', 'Earth', 3), ('Earth 4', '#C4B89C', 'Earth', 4),
      ('Earth 5', '#B4A888', 'Earth', 5),
      ('Nectar 1', '#FAF6E8', 'Nectar', 1), ('Nectar 2', '#F6F2E0', 'Nectar', 2),
      ('Nectar 3', '#F2EED8', 'Nectar', 3), ('Nectar 4', '#EEE8CC', 'Nectar', 4),
      ('Nectar 5', '#E8E2C0', 'Nectar', 5), ('Nectar 6', '#E0D8AC', 'Nectar', 6),
      ('Frost 1', '#F0F4F6', 'Frost', 1), ('Frost 2', '#E0E8EC', 'Frost', 2),
      ('Frost 3', '#C8D4DC', 'Frost', 3), ('Frost 4', '#A8B8C4', 'Frost', 4),
      ('Relic 1', '#E4E8E4', 'Relic', 1), ('Relic 2', '#D0D4D0', 'Relic', 2),
      ('Relic 3', '#B0B8B0', 'Relic', 3), ('Relic 4', '#949C94', 'Relic', 4);
  END IF;
END $$;


-- ============================================================================
-- 5) BUILD YOUR OWN system (editable à-la-carte system)
-- ============================================================================
INSERT INTO public.systems (name, description, surface_type, family, is_active, display_order)
SELECT 'Build Your Own', 'Pick and choose individual products', 'both', 'Build Your Own', true, 999
WHERE NOT EXISTS (SELECT 1 FROM public.systems WHERE family = 'Build Your Own');

WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
dp AS (
  SELECT DISTINCT ON (sp.product_id)
    sp.product_id, sp.stage_id, sp.coverage_sqm, sp.coverage_note,
    sp.has_pigment, sp.min_coats, sp.max_coats, sp.default_coats,
    sp.option_group, sp.display_order
  FROM public.system_products sp
  JOIN public.products p ON p.id = sp.product_id
  WHERE p.is_active = true AND p.code <> 'pigment'
  ORDER BY sp.product_id, sp.display_order
)
INSERT INTO public.system_products (
  system_id, product_id, stage_id, coverage_sqm, coverage_note,
  has_pigment, min_coats, max_coats, default_coats,
  is_optional, is_default_option, option_group, display_order, shared_across_surfaces)
SELECT byo.id, dp.product_id, dp.stage_id, dp.coverage_sqm, dp.coverage_note,
       dp.has_pigment, dp.min_coats, dp.max_coats, dp.default_coats,
       true, false, dp.option_group, dp.display_order, false
FROM dp CROSS JOIN byo
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_products x WHERE x.system_id = byo.id AND x.product_id = dp.product_id);


-- ============================================================================
-- 6) Conditional Quartz blinding on BondPrime in REGULAR systems
-- ============================================================================
INSERT INTO public.system_products (
  system_id, product_id, stage_id, coverage_sqm,
  default_coats, min_coats, max_coats,
  has_pigment, pigment_default_on, is_optional, is_default_option,
  coverage_note, display_order, depends_on_product_id, shared_across_surfaces)
SELECT bp.system_id,
  (SELECT id FROM public.products WHERE code = 'quartz'),
  bp.stage_id, 6, 1, 1, 1, false, false, true, true,
  '25kg bag covers 6m² - blinding sand',
  bp.display_order + 1, bp.id, false
FROM public.system_products bp
JOIN public.products p ON p.id = bp.product_id AND p.code = 'bondprime'
JOIN public.systems s  ON s.id = bp.system_id AND COALESCE(s.family,'') <> 'Build Your Own'
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_products q
  WHERE q.system_id = bp.system_id
    AND q.depends_on_product_id = bp.id
    AND q.product_id = (SELECT id FROM public.products WHERE code = 'quartz'));


-- ============================================================================
-- 7) PRODUCT-LEVEL COVERAGE & COATS DEFAULTS (inherited; per-system override)
-- ============================================================================
-- Backfill product defaults from the most common value across systems
WITH r AS (SELECT product_id, coverage_sqm,
    row_number() OVER (PARTITION BY product_id ORDER BY count(*) DESC, coverage_sqm) rn
  FROM public.system_products WHERE coverage_sqm IS NOT NULL AND coverage_sqm > 0
  GROUP BY product_id, coverage_sqm)
UPDATE public.products p SET coverage_sqm = r.coverage_sqm
FROM r WHERE r.product_id = p.id AND r.rn = 1 AND p.coverage_sqm IS NULL;

WITH r AS (SELECT product_id, default_coats,
    row_number() OVER (PARTITION BY product_id ORDER BY count(*) DESC, default_coats) rn
  FROM public.system_products WHERE default_coats IS NOT NULL GROUP BY product_id, default_coats)
UPDATE public.products p SET default_coats = r.default_coats
FROM r WHERE r.product_id = p.id AND r.rn = 1 AND p.default_coats IS NULL;

WITH r AS (SELECT product_id, min_coats,
    row_number() OVER (PARTITION BY product_id ORDER BY count(*) DESC, min_coats) rn
  FROM public.system_products WHERE min_coats IS NOT NULL GROUP BY product_id, min_coats)
UPDATE public.products p SET min_coats = r.min_coats
FROM r WHERE r.product_id = p.id AND r.rn = 1 AND p.min_coats IS NULL;

WITH r AS (SELECT product_id, max_coats,
    row_number() OVER (PARTITION BY product_id ORDER BY count(*) DESC, max_coats) rn
  FROM public.system_products WHERE max_coats IS NOT NULL GROUP BY product_id, max_coats)
UPDATE public.products p SET max_coats = r.max_coats
FROM r WHERE r.product_id = p.id AND r.rn = 1 AND p.max_coats IS NULL;

WITH r AS (SELECT product_id, coverage_note,
    row_number() OVER (PARTITION BY product_id ORDER BY count(*) DESC) rn
  FROM public.system_products WHERE coverage_note IS NOT NULL AND coverage_note <> ''
  GROUP BY product_id, coverage_note)
UPDATE public.products p SET coverage_note = r.coverage_note
FROM r WHERE r.product_id = p.id AND r.rn = 1 AND p.coverage_note IS NULL;

UPDATE public.products SET default_coats = 1 WHERE default_coats IS NULL;
UPDATE public.products SET min_coats     = 1 WHERE min_coats IS NULL;
UPDATE public.products SET max_coats     = COALESCE(default_coats, 1) WHERE max_coats IS NULL;

-- DPM epoxy carries BOTH rates (standard + over-mesh)
UPDATE public.products
SET coverage_sqm = 20, coverage_sqm_over_mesh = 6.67,
    coverage_note = 'Standard 0.25 kg/m² (≈20 m²/pack) · Over mesh 0.75 kg/m² (≈6.67 m²/pack)'
WHERE code IN ('dpm_std', 'dpm_fast');

-- Null system overrides that match the product default (so they inherit)
UPDATE public.system_products sp SET coverage_sqm  = NULL FROM public.products p
  WHERE sp.product_id = p.id AND sp.coverage_sqm  IS NOT NULL AND p.coverage_sqm  IS NOT NULL AND sp.coverage_sqm  = p.coverage_sqm;
UPDATE public.system_products sp SET default_coats = NULL FROM public.products p
  WHERE sp.product_id = p.id AND sp.default_coats IS NOT NULL AND p.default_coats IS NOT NULL AND sp.default_coats = p.default_coats;
UPDATE public.system_products sp SET min_coats     = NULL FROM public.products p
  WHERE sp.product_id = p.id AND sp.min_coats     IS NOT NULL AND p.min_coats     IS NOT NULL AND sp.min_coats     = p.min_coats;
UPDATE public.system_products sp SET max_coats     = NULL FROM public.products p
  WHERE sp.product_id = p.id AND sp.max_coats     IS NOT NULL AND p.max_coats     IS NOT NULL AND sp.max_coats     = p.max_coats;

-- Build Your Own DPM inherits both product rates (drives the over-mesh/standard toggle)
UPDATE public.system_products sp
SET coverage_sqm = NULL, coverage_sqm_over_mesh = NULL, coverage_sqm_per_pack = NULL
FROM public.systems s, public.products p
WHERE sp.system_id = s.id AND s.family = 'Build Your Own'
  AND sp.product_id = p.id AND p.code IN ('dpm_std', 'dpm_fast');


-- ============================================================================
-- 8) BUILD YOUR OWN — Quartz scatter over BOTH the DPM epoxy and BondPrime
-- ============================================================================
-- "over DPM" scatter: existing BYO Quartz, placed after the DPM epoxy
WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
anchor AS (
  SELECT sp.stage_id, MIN(sp.display_order) AS ord
  FROM public.system_products sp JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo) AND p.code IN ('dpm_std', 'dpm_fast')
  GROUP BY sp.stage_id)
UPDATE public.system_products sp SET display_order = sp.display_order + 10
FROM anchor, public.products p
WHERE sp.system_id = (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1)
  AND sp.stage_id = anchor.stage_id AND sp.product_id = p.id
  AND p.code NOT IN ('dpm_std', 'dpm_fast', 'quartz') AND sp.display_order > anchor.ord;

WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
anchor AS (
  SELECT sp.stage_id, MIN(sp.display_order) AS ord
  FROM public.system_products sp JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo) AND p.code IN ('dpm_std', 'dpm_fast') GROUP BY sp.stage_id),
dpm_ids AS (
  SELECT array_agg(sp.id) AS ids FROM public.system_products sp JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo) AND p.code IN ('dpm_std', 'dpm_fast'))
UPDATE public.system_products q
SET stage_id = (SELECT stage_id FROM anchor), display_order = (SELECT ord FROM anchor) + 1,
    option_group = 'scatter_dpm', depends_on_product_ids = (SELECT ids FROM dpm_ids),
    depends_on_product_id = NULL, is_optional = true,
    coverage_note = 'Scatter over DPM epoxy · 25kg bag ≈ 6 m²'
WHERE q.system_id = (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1)
  AND q.product_id = (SELECT id FROM public.products WHERE code = 'quartz')
  AND (q.option_group IS NULL OR q.option_group = 'scatter_dpm');

-- "over BondPrime" scatter: a second BYO Quartz at the end of the Base Coats stage
WITH byo AS (SELECT id FROM public.systems WHERE family = 'Build Your Own' LIMIT 1),
bp AS (
  SELECT sp.id AS sp_id, sp.stage_id FROM public.system_products sp JOIN public.products p ON p.id = sp.product_id
  WHERE sp.system_id = (SELECT id FROM byo) AND p.code = 'bondprime' LIMIT 1),
maxord AS (
  SELECT COALESCE(MAX(sp.display_order), 0) + 1 AS ord FROM public.system_products sp, bp
  WHERE sp.system_id = (SELECT id FROM byo) AND sp.stage_id = bp.stage_id)
INSERT INTO public.system_products (
  system_id, product_id, stage_id, coverage_sqm, default_coats, min_coats, max_coats,
  has_pigment, pigment_default_on, is_optional, is_default_option,
  option_group, coverage_note, display_order, depends_on_product_id, shared_across_surfaces)
SELECT (SELECT id FROM byo), (SELECT id FROM public.products WHERE code = 'quartz'),
       (SELECT stage_id FROM bp), 6, 1, 1, 1, false, false, true, false,
       'scatter_bondprime', 'Scatter over BondPrime · 25kg bag ≈ 6 m²',
       (SELECT ord FROM maxord), (SELECT sp_id FROM bp), false
WHERE EXISTS (SELECT 1 FROM bp)
  AND NOT EXISTS (
    SELECT 1 FROM public.system_products x WHERE x.system_id = (SELECT id FROM byo)
      AND x.product_id = (SELECT id FROM public.products WHERE code = 'quartz')
      AND x.option_group = 'scatter_bondprime');


-- ============================================================================
-- 9) DEDUPE exact-duplicate system_products (keep earliest)
-- ============================================================================
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY system_id, product_id, stage_id,
                 COALESCE(option_group, ''), COALESCE(depends_on_product_id::text, '')
    ORDER BY created_at, id) AS rn
  FROM public.system_products)
DELETE FROM public.system_products WHERE id IN (SELECT id FROM ranked WHERE rn > 1);


-- ============================================================================
-- 10) ROW LEVEL SECURITY (idempotent: drop-then-create)
-- ============================================================================
-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile"     ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"   ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"   ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
CREATE POLICY "Users can view own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id
    AND role   = (SELECT role   FROM profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can view all profiles"   ON profiles FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (is_admin());

-- settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON settings;
DROP POLICY IF EXISTS "Admins can modify settings"            ON settings;
CREATE POLICY "Authenticated users can read settings" ON settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify settings"            ON settings FOR ALL    USING (is_admin());

-- custom_colours
ALTER TABLE custom_colours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read custom colours" ON custom_colours;
DROP POLICY IF EXISTS "Users can create own custom colours"         ON custom_colours;
DROP POLICY IF EXISTS "Users can update own custom colours"         ON custom_colours;
DROP POLICY IF EXISTS "Admins can manage all custom colours"        ON custom_colours;
CREATE POLICY "Authenticated users can read custom colours" ON custom_colours FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can create own custom colours"         ON custom_colours FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own custom colours"         ON custom_colours FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Admins can manage all custom colours"        ON custom_colours FOR ALL    USING (is_admin());

-- colours
ALTER TABLE colours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read colours" ON colours;
DROP POLICY IF EXISTS "Admins can modify colours"            ON colours;
CREATE POLICY "Authenticated users can read colours" ON colours FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can modify colours"            ON colours FOR ALL    USING (is_admin());

-- quotes + quote_items
DROP POLICY IF EXISTS "Users can view own quotes"   ON public.quotes;
DROP POLICY IF EXISTS "Users can create own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can view all quotes"  ON public.quotes;
CREATE POLICY "Users can view own quotes"   ON public.quotes FOR SELECT USING (created_by = auth.uid());
CREATE POLICY "Users can create own quotes" ON public.quotes FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can update own quotes" ON public.quotes FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Users can delete own quotes" ON public.quotes FOR DELETE USING (created_by = auth.uid());
CREATE POLICY "Admins can view all quotes"  ON public.quotes FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Users can view own quote items"   ON public.quote_items;
DROP POLICY IF EXISTS "Users can manage own quote items" ON public.quote_items;
CREATE POLICY "Users can view own quote items" ON public.quote_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.created_by = auth.uid() OR is_admin())));
CREATE POLICY "Users can manage own quote items" ON public.quote_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.created_by = auth.uid()));

-- systems config tables: authenticated read, admin write
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['systems','system_products','stages','finish_presets','finish_preset_products'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS "read %1$s"  ON public.%1$I;', t);
      EXECUTE format('DROP POLICY IF EXISTS "admin %1$s" ON public.%1$I;', t);
      EXECUTE format('CREATE POLICY "read %1$s"  ON public.%1$I FOR SELECT USING (auth.role() = ''authenticated'');', t);
      EXECUTE format('CREATE POLICY "admin %1$s" ON public.%1$I FOR ALL    USING (is_admin());', t);
    END IF;
  END LOOP;
END $$;

-- login_logs: users insert only their own
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System can insert login logs" ON public.login_logs;
DROP POLICY IF EXISTS "Users insert own login logs"  ON public.login_logs;
CREATE POLICY "Users insert own login logs" ON public.login_logs FOR INSERT WITH CHECK (user_id = auth.uid());

-- activity_log: users insert + view own, admins view all
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own activity logs" ON activity_log;
DROP POLICY IF EXISTS "Users insert own activity"          ON activity_log;
DROP POLICY IF EXISTS "Admins can view all activity logs"  ON activity_log;
DROP POLICY IF EXISTS "Users can view own activity logs"   ON activity_log;
CREATE POLICY "Users can insert own activity logs" ON activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all activity logs"  ON activity_log FOR SELECT USING (is_admin());
CREATE POLICY "Users can view own activity logs"   ON activity_log FOR SELECT USING (auth.uid() = user_id);
GRANT SELECT, INSERT ON activity_log TO authenticated;

-- Done.
