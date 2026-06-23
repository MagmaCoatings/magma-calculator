-- =====================================================================
-- SECURITY FIX: enable Row Level Security on quotes + quote_items
-- ---------------------------------------------------------------------
-- Root cause: the owner/admin SELECT policies on these tables existed,
-- but RLS was never ENABLED on the tables themselves. Postgres ignores
-- policies entirely when RLS is disabled, so every authenticated user
-- (including installers) could read ALL quotes and quote_items.
--
-- This script enables RLS and (idempotently) re-asserts the strict
-- owner + admin policies. Safe to run multiple times.
-- Run in: Supabase Dashboard -> SQL Editor.
-- =====================================================================

-- 1) Turn RLS ON (this is the actual fix)
ALTER TABLE public.quotes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items  ENABLE ROW LEVEL SECURITY;

-- 2) Re-assert the intended policies (drop-then-create = idempotent)
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

-- 3) Verify: both should show rowsecurity = true
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN ('quotes', 'quote_items')
ORDER BY relname;
