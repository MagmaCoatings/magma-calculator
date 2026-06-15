-- ============================================
-- FIX PROFILES RLS (Privilege Escalation Bug)
-- ============================================

-- Create admin helper function (avoids recursion)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile BUT NOT role or status
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND status = (SELECT status FROM profiles WHERE id = auth.uid())
  );

-- Admins can view all profiles (using helper to avoid recursion)
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- ============================================
-- RLS FOR SETTINGS TABLE
-- ============================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings
CREATE POLICY "Authenticated users can read settings" ON settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can modify settings
CREATE POLICY "Admins can modify settings" ON settings
  FOR ALL USING (is_admin());

-- ============================================
-- RLS FOR CUSTOM_COLOURS TABLE
-- ============================================

ALTER TABLE custom_colours ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read custom colours
CREATE POLICY "Authenticated users can read custom colours" ON custom_colours
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can create their own custom colours
CREATE POLICY "Users can create own custom colours" ON custom_colours
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update their own custom colours
CREATE POLICY "Users can update own custom colours" ON custom_colours
  FOR UPDATE USING (auth.uid() = created_by);

-- Admins can manage all custom colours
CREATE POLICY "Admins can manage all custom colours" ON custom_colours
  FOR ALL USING (is_admin());

-- ============================================
-- RLS FOR COLOURS TABLE
-- ============================================

ALTER TABLE colours ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read colours
CREATE POLICY "Authenticated users can read colours" ON colours
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can modify colours
CREATE POLICY "Admins can modify colours" ON colours
  FOR ALL USING (is_admin());
