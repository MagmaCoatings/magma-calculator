-- ============================================
-- MAGMA CALCULATOR - RLS SECURITY FIXES
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- A1: Fix quotes RLS column mismatch
-- (policies referenced user_id but table uses created_by)
-- ============================================

-- QUOTES
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

-- QUOTE ITEMS (scoped through the parent quote)
DROP POLICY IF EXISTS "Users can view own quote items"   ON public.quote_items;
DROP POLICY IF EXISTS "Users can manage own quote items" ON public.quote_items;

CREATE POLICY "Users can view own quote items" ON public.quote_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.created_by = auth.uid() OR is_admin())));
CREATE POLICY "Users can manage own quote items" ON public.quote_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.created_by = auth.uid()));


-- ============================================
-- A2: Add RLS to systems tables
-- (authenticated users can read, only admins can write)
-- ============================================

DO $$ 
DECLARE 
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['systems','system_products','stages','finish_presets','finish_preset_products']
  LOOP
    -- Check if table exists before applying policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS "read %1$s" ON public.%1$I;', t);
      EXECUTE format('DROP POLICY IF EXISTS "admin %1$s" ON public.%1$I;', t);
      EXECUTE format('CREATE POLICY "read %1$s"  ON public.%1$I FOR SELECT USING (auth.role() = ''authenticated'');', t);
      EXECUTE format('CREATE POLICY "admin %1$s" ON public.%1$I FOR ALL    USING (is_admin());', t);
      RAISE NOTICE 'Applied RLS to: %', t;
    ELSE
      RAISE NOTICE 'Table does not exist, skipping: %', t;
    END IF;
  END LOOP;
END $$;


-- ============================================
-- A3: Stop audit-log spoofing
-- (users can only insert logs for themselves)
-- ============================================

-- LOGIN_LOGS
DROP POLICY IF EXISTS "System can insert login logs" ON public.login_logs;
DROP POLICY IF EXISTS "Users insert own login logs"  ON public.login_logs;

CREATE POLICY "Users insert own login logs" ON public.login_logs 
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ACTIVITY_LOG (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert activity log" ON public.activity_log;';
    EXECUTE 'DROP POLICY IF EXISTS "Users insert own activity" ON public.activity_log;';
    EXECUTE 'CREATE POLICY "Users insert own activity" ON public.activity_log FOR INSERT WITH CHECK (user_id = auth.uid());';
    RAISE NOTICE 'Applied audit-log policy to: activity_log';
  ELSE
    RAISE NOTICE 'activity_log table does not exist, skipping';
  END IF;
END $$;


-- ============================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================

-- Check RLS is enabled on all tables:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('quotes', 'quote_items', 'systems', 'system_products', 'stages', 'finish_presets', 'finish_preset_products', 'login_logs', 'activity_log')
ORDER BY tablename;

-- List all policies on these tables:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('quotes', 'quote_items', 'systems', 'system_products', 'stages', 'finish_presets', 'finish_preset_products', 'login_logs', 'activity_log')
ORDER BY tablename, policyname;
