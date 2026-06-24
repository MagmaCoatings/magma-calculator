-- =====================================================================
-- SECURITY: enable RLS on the remaining public tables flagged by the
-- Supabase Security Advisor ("rls_disabled_in_public").
-- ---------------------------------------------------------------------
-- products              -> holds products, consumables AND prices.
--                          Without RLS, anyone with the anon key could
--                          read/insert/update/delete pricing.
-- product_price_history -> price-change audit log.
--
-- Both get RLS enabled + the same access model used elsewhere:
--   * any signed-in user can READ products (the calculator needs them)
--   * only admins can WRITE products
--   * only admins can READ the price history (writes happen via the
--     SECURITY DEFINER audit trigger, which bypasses RLS)
--
-- Idempotent + safe to run multiple times. Run in: Supabase -> SQL Editor.
-- =====================================================================

-- ---- products -------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read products"  ON public.products;
DROP POLICY IF EXISTS "admin products" ON public.products;

CREATE POLICY "read products"  ON public.products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin products" ON public.products FOR ALL    USING (is_admin());

-- ---- product_price_history -----------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='product_price_history') THEN
    EXECUTE 'ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "admin read price history" ON public.product_price_history';
    EXECUTE 'CREATE POLICY "admin read price history" ON public.product_price_history FOR SELECT USING (is_admin())';
  END IF;
END $$;

-- ---- DIAGNOSTIC: list ANY public tables that still have RLS disabled.
-- After running the above, this should return ZERO rows. If it returns
-- anything, those tables also need RLS enabling (send me the list).
SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = false
ORDER BY c.relname;
