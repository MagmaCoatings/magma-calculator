-- First, clear existing colours and repopulate with correct hex values from HTML file
DELETE FROM colours;

-- Insert all colours with correct hex values (matching magma_calculator_v5.html)
INSERT INTO colours (name, hex_code, family, display_order) VALUES
  -- Natural (no pigment option)
  ('Natural (No Pigment)', '#F5F5F0', 'Natural', 0),
  
  -- Grey family
  ('Grey 1', '#E8E6E0', 'Grey', 1),
  ('Grey 2', '#DCDAD4', 'Grey', 2),
  ('Grey 3', '#C8C4BC', 'Grey', 3),
  ('Grey 4', '#A8A69E', 'Grey', 4),
  ('Grey 5', '#8A8880', 'Grey', 5),
  ('Grey 6', '#6E6C66', 'Grey', 6),
  
  -- Plume family
  ('Plume 1', '#E4DED8', 'Plume', 1),
  ('Plume 2', '#D4CCC4', 'Plume', 2),
  ('Plume 3', '#C4B8B0', 'Plume', 3),
  ('Plume 4', '#A8988C', 'Plume', 4),
  ('Plume 5', '#988478', 'Plume', 5),
  
  -- Earth family
  ('Earth 1', '#E8E2D4', 'Earth', 1),
  ('Earth 2', '#DCD4C4', 'Earth', 2),
  ('Earth 3', '#D0C8B4', 'Earth', 3),
  ('Earth 4', '#C4B89C', 'Earth', 4),
  ('Earth 5', '#B4A888', 'Earth', 5),
  
  -- Nectar family
  ('Nectar 1', '#FAF6E8', 'Nectar', 1),
  ('Nectar 2', '#F6F2E0', 'Nectar', 2),
  ('Nectar 3', '#F2EED8', 'Nectar', 3),
  ('Nectar 4', '#EEE8CC', 'Nectar', 4),
  ('Nectar 5', '#E8E2C0', 'Nectar', 5),
  ('Nectar 6', '#E0D8AC', 'Nectar', 6),
  
  -- Frost family
  ('Frost 1', '#F0F4F6', 'Frost', 1),
  ('Frost 2', '#E0E8EC', 'Frost', 2),
  ('Frost 3', '#C8D4DC', 'Frost', 3),
  ('Frost 4', '#A8B8C4', 'Frost', 4),
  
  -- Relic family
  ('Relic 1', '#E4E8E4', 'Relic', 1),
  ('Relic 2', '#D0D4D0', 'Relic', 2),
  ('Relic 3', '#B0B8B0', 'Relic', 3),
  ('Relic 4', '#949C94', 'Relic', 4);

-- Settings table for calculator defaults
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO settings (key, value, description) VALUES
  ('default_floor_area', '20', 'Default floor area in m²'),
  ('default_wall_area', '10', 'Default wall area in m²'),
  ('default_wastage_percent', '10', 'Default wastage percentage'),
  ('pigment_price', '15', 'Price per pigment pot in GBP'),
  ('vat_rate', '0.2', 'VAT rate (0.2 = 20%)')
ON CONFLICT (key) DO NOTHING;

-- System family column for grouping
ALTER TABLE systems ADD COLUMN IF NOT EXISTS family text DEFAULT 'Microcement';
ALTER TABLE systems ADD COLUMN IF NOT EXISTS build_type text DEFAULT 'standard';

-- Custom colours table for Farrow & Ball, Little Greene, etc.
CREATE TABLE IF NOT EXISTS custom_colours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hex text NOT NULL,
  brand text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add custom colour fields to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_name text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_hex text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_brand text;
