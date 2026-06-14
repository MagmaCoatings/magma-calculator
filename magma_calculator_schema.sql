-- ============================================
-- MAGMA CALCULATOR - SUPABASE SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor (SQL > New Query)
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTH
-- ============================================
-- Note: Supabase Auth handles the core auth.users table
-- This extends it with installer-specific data

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'installer' CHECK (role IN ('admin', 'installer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- LOGIN TRACKING
-- ============================================

CREATE TABLE public.login_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  city TEXT,
  country TEXT,
  user_agent TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  os TEXT,
  is_suspicious BOOLEAN DEFAULT FALSE,
  suspicious_reason TEXT
);

CREATE INDEX idx_login_logs_user_id ON public.login_logs(user_id);
CREATE INDEX idx_login_logs_logged_in_at ON public.login_logs(logged_in_at DESC);
CREATE INDEX idx_login_logs_ip_address ON public.login_logs(ip_address);

-- ============================================
-- PRODUCT CATEGORIES
-- ============================================

CREATE TABLE public.product_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.product_categories (name, display_order) VALUES
  ('DPM & Primers', 1),
  ('Mesh & Reinforcement', 2),
  ('Aggregates', 3),
  ('Base Coats', 4),
  ('Microcement', 5),
  ('Pore Fillers', 6),
  ('Sealers', 7),
  ('Pigments', 8),
  ('Membranes', 9);

-- ============================================
-- PRODUCTS
-- ============================================

CREATE TABLE public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- internal reference e.g. 'dpm_std', 'magma_500'
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.product_categories(id),
  description TEXT,
  pack_size DECIMAL(10,2) NOT NULL, -- e.g. 5, 20, 50
  pack_unit TEXT NOT NULL, -- 'kg', 'L', 'm', 'roll', 'set', 'pot'
  coverage_rate DECIMAL(10,4), -- amount per m² (e.g. 0.6 for 600g/m²)
  coverage_unit TEXT, -- 'kg', 'L', 'm²' (for mesh rolls)
  coverage_note TEXT, -- e.g. 'per coat', 'over mesh'
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_code ON public.products(code);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active ON public.products(is_active);

-- ============================================
-- PRODUCT PRICE HISTORY
-- ============================================

CREATE TABLE public.product_price_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  old_price DECIMAL(10,2) NOT NULL,
  new_price DECIMAL(10,2) NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);

-- Trigger to log price changes
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO public.product_price_history (product_id, old_price, new_price)
    VALUES (NEW.id, OLD.price, NEW.price);
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_product_price_change
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION log_price_change();

-- ============================================
-- SEED PRODUCTS
-- ============================================

INSERT INTO public.products (code, name, category_id, pack_size, pack_unit, coverage_rate, coverage_unit, coverage_note, price) VALUES
  -- DPM & Primers
  ('dpm_std', 'DPM Epoxy Primer Std Cure', (SELECT id FROM product_categories WHERE name = 'DPM & Primers'), 5, 'kg', 0.25, 'kg', 'standard application', 80.00),
  ('dpm_fast', 'DPM Epoxy Primer Fast Cure', (SELECT id FROM product_categories WHERE name = 'DPM & Primers'), 5, 'kg', 0.25, 'kg', 'standard application', 85.00),
  ('primer_180', 'Primer 180', (SELECT id FROM product_categories WHERE name = 'DPM & Primers'), 5, 'L', 0.15, 'L', NULL, 46.00),
  ('primer_200', 'Primer 200', (SELECT id FROM product_categories WHERE name = 'DPM & Primers'), 5, 'kg', 0.15, 'kg', NULL, 46.00),
  ('primer_250', 'Primer 250 Grit', (SELECT id FROM product_categories WHERE name = 'DPM & Primers'), 5, 'kg', 0.15, 'kg', NULL, 70.00),
  
  -- Mesh & Reinforcement
  ('mesh_62', 'Fibreglass Mesh 62', (SELECT id FROM product_categories WHERE name = 'Mesh & Reinforcement'), 50, 'm', 1, 'm²', 'per roll', 78.00),
  ('mesh_88', 'Fibreglass Mesh 88', (SELECT id FROM product_categories WHERE name = 'Mesh & Reinforcement'), 50, 'm', 1, 'm²', 'per roll', 78.00),
  
  -- Aggregates
  ('quartz', 'Quartz 0.4-0.8mm', (SELECT id FROM product_categories WHERE name = 'Aggregates'), 25, 'kg', 4.17, 'kg', '1 bag per 6m²', 14.50),
  
  -- Base Coats
  ('bondprime', 'BondPrime SC', (SELECT id FROM product_categories WHERE name = 'Base Coats'), 10, 'kg', 1.5, 'kg', 'over mesh (1kg over epoxy/quartz)', 65.00),
  ('magma_200', 'Magma 200 XL Base', (SELECT id FROM product_categories WHERE name = 'Microcement'), 20, 'kg', 2, 'kg', 'per coat', 153.80),
  
  -- Microcement
  ('magma_300', 'Magma 300 Large', (SELECT id FROM product_categories WHERE name = 'Microcement'), 20, 'kg', 1, 'kg', 'per coat', 153.80),
  ('magma_500', 'Magma 500 Medium', (SELECT id FROM product_categories WHERE name = 'Microcement'), 20, 'kg', 0.6, 'kg', 'per coat', 153.80),
  ('magma_700', 'Magma 700 Smooth', (SELECT id FROM product_categories WHERE name = 'Microcement'), 20, 'kg', 0.35, 'kg', 'per coat', 172.80),
  
  -- Pore Fillers
  ('xero_pore', 'Xero Pore Filler', (SELECT id FROM product_categories WHERE name = 'Pore Fillers'), 2.5, 'kg', 0.1, 'kg', NULL, 65.00),
  ('ep_gela', 'EP Gela', (SELECT id FROM product_categories WHERE name = 'Pore Fillers'), 0.6, 'set', 0.1, 'set', '1 set per 10m²', 30.00),
  
  -- Sealers
  ('pu_seal_matt', 'PU Seal Matt', (SELECT id FROM product_categories WHERE name = 'Sealers'), 5, 'kg', 0.0833, 'kg', '5kg covers 60m² per coat', 145.00),
  ('pu_seal_satin', 'PU Seal Satin', (SELECT id FROM product_categories WHERE name = 'Sealers'), 5, 'kg', 0.0833, 'kg', '5kg covers 60m² per coat', 145.00),
  
  -- Pigments
  ('pigment', 'Pigment Pot', (SELECT id FROM product_categories WHERE name = 'Pigments'), 1, 'pot', 0.05, 'pot', '1 pot per 20kg Magma', 15.00),
  
  -- Membranes
  ('liquid_membrane_5', 'Liquid Membrane 5L', (SELECT id FROM product_categories WHERE name = 'Membranes'), 5, 'L', 0.15, 'L', 'per layer', 159.00),
  ('liquid_membrane_10', 'Liquid Membrane 10L', (SELECT id FROM product_categories WHERE name = 'Membranes'), 10, 'L', 0.15, 'L', 'per layer', 266.00),
  ('liquid_membrane_20', 'Liquid Membrane 20L', (SELECT id FROM product_categories WHERE name = 'Membranes'), 20, 'L', 0.15, 'L', 'per layer', 441.00);

-- ============================================
-- COLOUR FAMILIES & SWATCHES
-- ============================================

CREATE TABLE public.colour_families (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0
);

CREATE TABLE public.colour_swatches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES public.colour_families(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  hex_code TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.colour_families (name, display_order) VALUES
  ('Grey', 1), ('Plume', 2), ('Earth', 3), ('Nectar', 4), ('Frost', 5), ('Relic', 6);

INSERT INTO public.colour_swatches (family_id, name, hex_code, display_order) VALUES
  -- Grey
  ((SELECT id FROM colour_families WHERE name = 'Grey'), 'Grey 1', '#E8E6E0', 1),
  ((SELECT id FROM colour_families WHERE name = 'Grey'), 'Grey 2', '#D8D4CC', 2),
  ((SELECT id FROM colour_families WHERE name = 'Grey'), 'Grey 3', '#C0BAB0', 3),
  ((SELECT id FROM colour_families WHERE name = 'Grey'), 'Grey 4', '#A09A90', 4),
  ((SELECT id FROM colour_families WHERE name = 'Grey'), 'Grey 5', '#787068', 5),
  ((SELECT id FROM colour_families WHERE name = 'Grey'), 'Grey 6', '#585048', 6),
  -- Plume
  ((SELECT id FROM colour_families WHERE name = 'Plume'), 'Plume 1', '#EAE4E0', 1),
  ((SELECT id FROM colour_families WHERE name = 'Plume'), 'Plume 2', '#DCD4CE', 2),
  ((SELECT id FROM colour_families WHERE name = 'Plume'), 'Plume 3', '#C8BCB4', 3),
  ((SELECT id FROM colour_families WHERE name = 'Plume'), 'Plume 4', '#A89C94', 4),
  ((SELECT id FROM colour_families WHERE name = 'Plume'), 'Plume 5', '#887C74', 5),
  -- Earth
  ((SELECT id FROM colour_families WHERE name = 'Earth'), 'Earth 1', '#F0E8DC', 1),
  ((SELECT id FROM colour_families WHERE name = 'Earth'), 'Earth 2', '#E4D8C8', 2),
  ((SELECT id FROM colour_families WHERE name = 'Earth'), 'Earth 3', '#D4C4AC', 3),
  ((SELECT id FROM colour_families WHERE name = 'Earth'), 'Earth 4', '#BCA888', 4),
  ((SELECT id FROM colour_families WHERE name = 'Earth'), 'Earth 5', '#9C8868', 5),
  -- Nectar
  ((SELECT id FROM colour_families WHERE name = 'Nectar'), 'Nectar 1', '#F8F4E8', 1),
  ((SELECT id FROM colour_families WHERE name = 'Nectar'), 'Nectar 2', '#F4F0DC', 2),
  ((SELECT id FROM colour_families WHERE name = 'Nectar'), 'Nectar 3', '#F0ECD0', 3),
  ((SELECT id FROM colour_families WHERE name = 'Nectar'), 'Nectar 4', '#EEE8CC', 4),
  ((SELECT id FROM colour_families WHERE name = 'Nectar'), 'Nectar 5', '#E8E2C0', 5),
  ((SELECT id FROM colour_families WHERE name = 'Nectar'), 'Nectar 6', '#E0D8AC', 6),
  -- Frost
  ((SELECT id FROM colour_families WHERE name = 'Frost'), 'Frost 1', '#F0F4F6', 1),
  ((SELECT id FROM colour_families WHERE name = 'Frost'), 'Frost 2', '#E0E8EC', 2),
  ((SELECT id FROM colour_families WHERE name = 'Frost'), 'Frost 3', '#C8D4DC', 3),
  ((SELECT id FROM colour_families WHERE name = 'Frost'), 'Frost 4', '#A8B8C4', 4),
  -- Relic
  ((SELECT id FROM colour_families WHERE name = 'Relic'), 'Relic 1', '#E4E8E4', 1),
  ((SELECT id FROM colour_families WHERE name = 'Relic'), 'Relic 2', '#D0D4D0', 2),
  ((SELECT id FROM colour_families WHERE name = 'Relic'), 'Relic 3', '#B0B8B0', 3),
  ((SELECT id FROM colour_families WHERE name = 'Relic'), 'Relic 4', '#949C94', 4);

-- ============================================
-- QUOTES
-- ============================================

CREATE TABLE public.quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  job_reference TEXT,
  client_name TEXT,
  surface_type TEXT NOT NULL, -- 'floor', 'wall', 'both', 'custom'
  floor_area DECIMAL(10,2),
  wall_area DECIMAL(10,2),
  build_config JSONB NOT NULL, -- full calculator state
  colour_id UUID REFERENCES public.colour_swatches(id),
  subtotal DECIMAL(10,2) NOT NULL,
  vat DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  wastage_percent INT NOT NULL DEFAULT 10,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX idx_quotes_created_at ON public.quotes(created_at DESC);

CREATE TABLE public.quote_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity_needed DECIMAL(10,2) NOT NULL, -- raw amount with wastage
  units_ordered INT NOT NULL, -- packs/rolls rounded up
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  notes TEXT -- e.g. '2 coats', 'for BP'
);

CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);

-- ============================================
-- ACTIVITY LOG (for admin dashboard)
-- ============================================

CREATE TABLE public.activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'login', 'quote_created', 'quote_viewed', 'product_updated'
  entity_type TEXT, -- 'quote', 'product', 'user'
  entity_id UUID,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_action ON public.activity_log(action);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colour_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colour_swatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read own, admins can read all
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Products: everyone can read active, admins can modify
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = TRUE OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Categories: everyone can read
CREATE POLICY "Anyone can view categories" ON public.product_categories
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage categories" ON public.product_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Colours: everyone can read
CREATE POLICY "Anyone can view colour families" ON public.colour_families
  FOR SELECT USING (TRUE);

CREATE POLICY "Anyone can view colour swatches" ON public.colour_swatches
  FOR SELECT USING (TRUE);

-- Quotes: users see own, admins see all
CREATE POLICY "Users can view own quotes" ON public.quotes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all quotes" ON public.quotes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create own quotes" ON public.quotes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own quotes" ON public.quotes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own quotes" ON public.quotes
  FOR DELETE USING (user_id = auth.uid());

-- Quote items follow quote permissions
CREATE POLICY "Users can view own quote items" ON public.quote_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.quotes WHERE id = quote_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can manage own quote items" ON public.quote_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.quotes WHERE id = quote_id AND user_id = auth.uid())
  );

-- Login logs: users see own, admins see all
CREATE POLICY "Users can view own login logs" ON public.login_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all login logs" ON public.login_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert login logs" ON public.login_logs
  FOR INSERT WITH CHECK (TRUE);

-- Activity log: admins only
CREATE POLICY "Admins can view activity log" ON public.activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert activity log" ON public.activity_log
  FOR INSERT WITH CHECK (TRUE);

-- Price history: admins only
CREATE POLICY "Admins can view price history" ON public.product_price_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user account is active
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.activity_log (user_id, action, entity_type, entity_id, metadata, ip_address)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_metadata, p_ip_address)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- ============================================
-- DONE!
-- ============================================
