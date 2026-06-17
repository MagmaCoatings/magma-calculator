-- Settings table for calculator defaults
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
  ('default_floor_area', '20', 'Default floor area in m²'),
  ('default_wall_area', '10', 'Default wall area in m²'),
  ('default_wastage_percent', '10', 'Default wastage percentage'),
  ('pigment_price', '15', 'Price per pigment pot in GBP'),
  ('vat_rate', '0.2', 'VAT rate (0.2 = 20%)')
ON CONFLICT (key) DO NOTHING;

-- Add family and build_type columns to systems table
ALTER TABLE systems ADD COLUMN IF NOT EXISTS family text DEFAULT 'Microcement';
ALTER TABLE systems ADD COLUMN IF NOT EXISTS build_type text DEFAULT 'standard';

-- Update existing systems with family and build_type
UPDATE systems SET 
  family = 'Microcement',
  build_type = CASE 
    WHEN name ILIKE '%belt%' OR name ILIKE '%braces%' THEN 'bb'
    ELSE 'standard'
  END
WHERE family IS NULL OR family = 'Microcement';

-- Custom colours table for special colours (Farrow & Ball, Little Greene, etc.)
CREATE TABLE IF NOT EXISTS custom_colours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hex text NOT NULL,
  brand text, -- e.g., "Farrow & Ball", "Little Greene"
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Add custom_colour_id to quotes table for saved custom colours
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_id uuid REFERENCES custom_colours(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_name text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_colour_hex text;
