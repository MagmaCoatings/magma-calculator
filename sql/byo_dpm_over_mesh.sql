-- ============================================
-- BUILD YOUR OWN — DPM epoxy "over mesh / standard" coverage
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- DPM epoxy primer is applied at two different rates:
--   • Over mesh:  0.75 kg/m²  → 5kg pack covers ~6.67 m²  (more epoxy needed)
--   • Standard:   0.25 kg/m²  → 5kg pack covers ~20 m²
--
-- We store BOTH on the Build Your Own DPM rows:
--   coverage_sqm          = over-mesh rate (6.67)
--   coverage_sqm_per_pack = standard rate (20)
--
-- The calculator shows an "Over mesh / Standard" choice on the DPM card,
-- defaulting to "Over mesh" when a reinforcement mesh is selected, and the
-- installer can override it. Edit the two numbers below to fine-tune.
-- ============================================

UPDATE public.system_products sp
SET coverage_sqm          = 6.67,   -- over mesh (0.75 kg/m²)
    coverage_sqm_per_pack = 20,     -- standard, no mesh (0.25 kg/m²)
    coverage_note = 'Over mesh 0.75 kg/m² (≈6.67 m²/pack) · Standard 0.25 kg/m² (≈20 m²/pack)'
FROM public.systems s, public.products p
WHERE sp.system_id = s.id
  AND s.family = 'Build Your Own'
  AND sp.product_id = p.id
  AND p.code IN ('dpm_std', 'dpm_fast');

-- Check the result:
-- SELECT p.code, sp.coverage_sqm AS over_mesh, sp.coverage_sqm_per_pack AS standard, sp.coverage_note
-- FROM system_products sp
-- JOIN systems s  ON s.id = sp.system_id AND s.family = 'Build Your Own'
-- JOIN products p ON p.id = sp.product_id
-- WHERE p.code IN ('dpm_std','dpm_fast');
