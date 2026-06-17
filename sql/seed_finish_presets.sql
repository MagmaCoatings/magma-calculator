-- ============================================
-- SEED a default "Standard" finish preset per system
-- Run in Supabase SQL Editor. Safe + idempotent.
--
-- For every system that has NO preset yet (excluding Build Your Own), create a
-- "Standard" preset and populate it from that system's own Microcement-stage
-- finish products (the default option of each, with their coats + pigment).
-- You can rename these / add variants (e.g. "Textured") in Admin → Systems afterwards.
-- ============================================

-- 1) Create the "Standard" preset for systems that don't have one
INSERT INTO public.finish_presets (system_id, name, description, is_default, is_active, display_order)
SELECT s.id, 'Standard', 'Default finish', true, true, 1
FROM public.systems s
WHERE COALESCE(s.family, '') <> 'Build Your Own'
  AND NOT EXISTS (SELECT 1 FROM public.finish_presets fp WHERE fp.system_id = s.id);

-- 2) Populate each new "Standard" preset from the system's default Microcement products
WITH micro AS (SELECT id FROM public.stages WHERE name = 'Microcement' LIMIT 1)
INSERT INTO public.finish_preset_products (
  preset_id, product_id, stage_id, default_coats, min_coats, max_coats, has_pigment, display_order)
SELECT fp.id,
       sp.product_id,
       (SELECT id FROM micro),
       COALESCE(sp.default_coats, p.default_coats, 1),
       COALESCE(sp.min_coats,     p.min_coats,     1),
       COALESCE(sp.max_coats,     p.max_coats,     2),
       sp.has_pigment,
       ROW_NUMBER() OVER (PARTITION BY fp.id ORDER BY sp.display_order)
FROM public.finish_presets fp
JOIN public.system_products sp
  ON sp.system_id = fp.system_id
 AND sp.stage_id  = (SELECT id FROM micro)
 AND (sp.is_default_option = true OR sp.option_group IS NULL)   -- the default finish of each system
JOIN public.products p ON p.id = sp.product_id
WHERE fp.name = 'Standard'
  AND NOT EXISTS (SELECT 1 FROM public.finish_preset_products fpp WHERE fpp.preset_id = fp.id);

-- Check the result:
-- SELECT s.name AS system, fp.name AS preset, p.name AS product, fpp.default_coats
-- FROM finish_presets fp
-- JOIN systems s   ON s.id = fp.system_id
-- LEFT JOIN finish_preset_products fpp ON fpp.preset_id = fp.id
-- LEFT JOIN products p ON p.id = fpp.product_id
-- ORDER BY s.name, fpp.display_order;
