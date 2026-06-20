-- ============================================
-- ADD: editable section heading for system layer-groups
-- Run in Supabase SQL Editor. Safe + idempotent.
--
-- Lets admins give a friendly heading to a layer-group in the calculator
-- (e.g. show "Primer" instead of the default product's name "Primer 200").
-- Stored per system_product; all products in the same group share the value.
-- Blank = fall back to the current heading (stage name / product name).
-- ============================================

ALTER TABLE public.system_products ADD COLUMN IF NOT EXISTS group_label text;
