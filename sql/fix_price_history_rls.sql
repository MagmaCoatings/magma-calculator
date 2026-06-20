-- ============================================
-- FIX: editing a product price fails with
--   "new row violates row-level security policy for table product_price_history"
-- Run in Supabase SQL Editor. Safe + idempotent.
--
-- Cause: the on_product_price_change trigger logs every price change into
-- product_price_history, but that table has RLS enabled with only a SELECT
-- policy (admins can view) and NO insert policy. The trigger runs as the
-- calling user, so its INSERT is blocked by RLS — and the whole UPDATE fails.
--
-- Fix: run the audit trigger with definer rights so the history insert always
-- succeeds (standard pattern for audit-log triggers). Also records who changed
-- it (changed_by = the signed-in admin).
-- ============================================

CREATE OR REPLACE FUNCTION public.log_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.product_price_history (product_id, old_price, new_price, changed_by)
    VALUES (NEW.id, OLD.price, NEW.price, auth.uid());
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
